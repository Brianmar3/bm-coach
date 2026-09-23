export function storedHeightToCentimeters(value: unknown) {
  const height = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(height) || height <= 0) return 0;
  return height <= 3 ? height * 100 : height;
}

export function centimetersToStoredHeight(value: unknown) {
  const height = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(height) || height <= 0) return 0;
  return height / 100;
}

export function bmiFromCentimeters(weight: number, height: number) {
  const meters = height / 100;
  return weight > 0 && meters > 0 ? (weight / (meters * meters)).toFixed(1) : "—";
}
