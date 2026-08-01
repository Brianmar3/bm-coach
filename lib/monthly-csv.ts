import type { MonthlySummaryData } from "@/types/monthly-summary";

function csvCell(value: string | number | null) {
  const text = value === null ? "No disponible" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function monthlySummaryCsv(data: MonthlySummaryData) {
  const headers = [
    "Mes", "Alumno", "Importe cobrado", "Importe esperado", "Saldo", "Estado de cuota",
    "Fechas de pago", "Métodos de pago", "Asistencias", "Faltas", "Justificadas",
    "Plan histórico", "Servicio histórico", "Frecuencia histórica", "Advertencias",
  ];
  const rows = data.detailRows.map((row) => [
    data.metadata.monthKey,
    row.studentName,
    row.collectedAmount,
    row.expectedAmount,
    row.balance,
    row.paymentStatus,
    row.paymentDates.join(" | "),
    row.paymentMethods.join(" | "),
    row.attendancePresent,
    row.attendanceAbsent,
    row.attendanceJustified,
    row.planName,
    row.serviceType,
    row.frequencyDays,
    row.warnings.join(" | "),
  ]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

export function monthlyGeneralCsv(data: MonthlySummaryData) {
  const rows: Array<[string, string | number | null]> = [
    ["Mes", data.metadata.monthKey],
    ["Estado", data.metadata.status],
    ["Total cobrado", data.summary.collectedTotal],
    ["Cantidad de pagos", data.summary.paymentCount],
    ["Ingreso esperado", data.summary.expectedTotal],
    ["Total pendiente", data.summary.pendingTotal],
    ["Porcentaje de cobranza", data.summary.collectionPercentage],
    ["Alumnos con actividad", data.summary.studentsWithActivity],
    ["Altas", data.summary.enrollments],
    ["Bajas", data.summary.deactivations],
    ["Asistencia promedio", data.summary.attendancePercentage],
  ];
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}
