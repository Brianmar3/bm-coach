export function profileDate(value: string | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
export function profileMeasurement(value: number | undefined, unit: string) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)} ${unit}` : "—";
}
