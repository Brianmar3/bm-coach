import { test } from "node:test";
import { strict as assert } from "node:assert";
import { displayMoney, moneyVisibilityKey, readMoneyVisibility } from "../lib/money-visibility.ts";

test("la preferencia local se separa por entrenador y espacio y persiste el estado oculto", () => {
  const values = new Map<string, string>();
  const storage = { getItem: (key: string) => values.get(key) ?? null };
  const first = moneyVisibilityKey("space-a", "trainer-a");
  const second = moneyVisibilityKey("space-a", "trainer-b");
  assert.notEqual(first, second);
  assert.notEqual(first, moneyVisibilityKey("space-b", "trainer-a"));
  assert.equal(readMoneyVisibility(storage, first), true);
  values.set(first, "hidden");
  assert.equal(readMoneyVisibility(storage, first), false);
  assert.equal(readMoneyVisibility(storage, second), true);
  assert.equal(displayMoney("$ 1.040.000", false), "$ ****");
  assert.equal(displayMoney("$ 1.040.000", true), "$ 1.040.000");
});
