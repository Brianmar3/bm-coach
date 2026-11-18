export const MASKED_MONEY = "$ ****";

export function moneyVisibilityKey(workspaceId: string, userId: string) {
  return `bm:money-visibility:${workspaceId}:${userId}`;
}

export function readMoneyVisibility(storage: Pick<Storage, "getItem">, key: string) {
  return storage.getItem(key) !== "hidden";
}

export function displayMoney(formatted: string, visible: boolean) {
  return visible ? formatted : MASKED_MONEY;
}
