export function classPlanDropIndex(source: number, destination: number, after: boolean) {
  const insertion = destination + (after ? 1 : 0);
  return insertion - (source < insertion ? 1 : 0);
}

export function canDropClassPlan(sourceDate: string, destinationDate: string) {
  return sourceDate === destinationDate;
}
