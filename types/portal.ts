import type { CoachEvent, Payment, PhysicalEvaluation, TrainingRoutine } from "@/types/gestion";

export type PortalProfile = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  birthDate: string;
  goal: string;
  plan: string;
  joinedAt: string;
  status: string;
};

export type PortalData = {
  profile: PortalProfile;
  routine: TrainingRoutine | null;
  evaluations: PhysicalEvaluation[];
  payments: Payment[];
  events: CoachEvent[];
};
