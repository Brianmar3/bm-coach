type WeightMeasurement = {
  studentId: string;
  date: string;
  weight: number | null;
  version?: number;
  createdAt?: string;
};

function registeredWeight(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

/** Uses recorded kilograms only. An evaluation without weight does not erase an older measurement. */
export function latestStudentWeight(studentId: string, measurements: WeightMeasurement[], profileWeight: number | null | undefined): number | null {
  const latest = measurements.filter(item => item.studentId === studentId && registeredWeight(item.weight))
    .sort((left, right) => right.date.localeCompare(left.date)
      || (right.version ?? 0) - (left.version ?? 0)
      || (right.createdAt ?? "").localeCompare(left.createdAt ?? ""))[0];
  return latest?.weight ?? (registeredWeight(profileWeight) ? profileWeight : null);
}

export function formatStudentWeight(weight: number | null): string {
  return registeredWeight(weight) ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(weight)} kg` : "Sin registrar";
}
