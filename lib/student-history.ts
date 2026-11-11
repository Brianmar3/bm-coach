import "server-only";

import { Prisma } from "@prisma/client";
import { argentinaDateKey, dateKeyToDatabase } from "@/lib/payment-dates";
import { normalizePlanName } from "@/lib/coach-plans";
import { membershipConfigurationChanged } from "@/lib/monthly-calculations";
import type { ParsedStudentInput } from "@/lib/student-enrollment";
import type { Student } from "@/types/gestion";

const HISTORY_ACTOR = "coach";

function membershipStatus(status: Student["status"]) {
  if (status === "suspendido") return "SUSPENDED" as const;
  return status === "inactivo" ? "INACTIVE" as const : "ACTIVE" as const;
}

function currentStudentStatus(current: Partial<Student>) {
  if (current.lifecycleStatus === "suspendido") return "suspendido" as const;
  return current.status === "inactivo" ? "inactivo" as const : "activo" as const;
}

function membershipValues(input: ParsedStudentInput) {
  return {
    planName: input.plan,
    frequencyDays: input.frequencyDays ?? null,
    serviceType: input.serviceType,
    monthlyAmount: Number.isFinite(input.monthlyFee) && input.monthlyFee > 0 ? input.monthlyFee : null,
    status: membershipStatus(input.status),
  };
}

export async function recordInitialStudentHistory(
  transaction: Prisma.TransactionClient,
  studentId: string,
  input: ParsedStudentInput,
) {
  const eventDate = dateKeyToDatabase(input.joinedAt);
  const historyStartDate = dateKeyToDatabase(argentinaDateKey());
  await Promise.all([
    transaction.studentMembershipHistory.create({
      data: { studentId, startDate: historyStartDate, ...membershipValues(input) },
    }),
    transaction.studentStatusEvent.create({
      data: { studentId, type: "ENROLLMENT", eventDate, actor: HISTORY_ACTOR },
    }),
  ]);
}

export async function recordStudentHistoryChange(
  transaction: Prisma.TransactionClient,
  studentId: string,
  currentData: Prisma.JsonValue,
  currentServiceType: ParsedStudentInput["serviceType"],
  input: ParsedStudentInput,
) {
  const current = currentData as unknown as Partial<Student>;
  const effectiveDate = dateKeyToDatabase(argentinaDateKey());
  const membershipChanged = membershipConfigurationChanged(
    { plan: current.plan ?? "", monthlyFee: Number(current.monthlyFee ?? 0), serviceType: currentServiceType, status: currentStudentStatus(current) },
    { plan: input.plan, monthlyFee: input.monthlyFee, serviceType: input.serviceType, status: input.status },
  );

  if (membershipChanged) {
    const samePlan = currentServiceType === input.serviceType && (current.planId && input.planId
      ? current.planId === input.planId
      : normalizePlanName(current.plan ?? "") === normalizePlanName(input.plan));
    const openMembership = samePlan ? await transaction.studentMembershipHistory.findFirst({
      where: { studentId, endDate: null, serviceType: currentServiceType },
      orderBy: { startDate: "desc" }, select: { frequencyDays: true },
    }) : null;
    await transaction.studentMembershipHistory.updateMany({
      where: { studentId, endDate: null },
      data: { endDate: effectiveDate, endReason: "Cambio registrado desde la ficha del alumno" },
    });
    await transaction.studentMembershipHistory.create({
      data: { studentId, startDate: effectiveDate, ...membershipValues(input),
        frequencyDays: openMembership ? openMembership.frequencyDays : input.frequencyDays ?? null },
    });
  }

  const previousStatus = currentStudentStatus(current);
  if (previousStatus !== input.status) {
    const eventType = input.status === "suspendido"
      ? "SUSPENSION" as const
      : input.status === "inactivo"
        ? "DEACTIVATION" as const
        : "REACTIVATION" as const;
    await transaction.studentStatusEvent.create({
      data: {
        studentId,
        type: eventType,
        eventDate: effectiveDate,
        actor: HISTORY_ACTOR,
      },
    });
  }
}

export async function recordStudentDeactivation(
  transaction: Prisma.TransactionClient,
  studentId: string,
  currentData: Prisma.JsonValue,
  currentServiceType: ParsedStudentInput["serviceType"],
) {
  const current = currentData as unknown as Partial<Student>;
  if (currentStudentStatus(current) === "inactivo") return;
  const effectiveDate = dateKeyToDatabase(argentinaDateKey());
  await transaction.studentMembershipHistory.updateMany({
    where: { studentId, endDate: null },
    data: { endDate: effectiveDate, endReason: "Baja registrada desde la ficha del alumno" },
  });
  await Promise.all([
    transaction.studentMembershipHistory.create({
      data: {
        studentId,
        startDate: effectiveDate,
        planName: current.plan ?? "Sin plan",
        frequencyDays: null,
        serviceType: currentServiceType,
        monthlyAmount: Number(current.monthlyFee ?? 0) > 0 ? Number(current.monthlyFee) : null,
        status: "INACTIVE",
      },
    }),
    transaction.studentStatusEvent.create({
      data: { studentId, type: "DEACTIVATION", eventDate: effectiveDate, actor: HISTORY_ACTOR },
    }),
  ]);
}
