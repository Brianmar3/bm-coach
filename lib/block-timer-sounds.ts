export type BlockTimerSound = "work" | "rest" | "finish";

export type BellStrike = { delaySeconds: number; durationSeconds: number; volume: number };

export function bellStrikes(sound: BlockTimerSound): BellStrike[] {
  if (sound === "rest") return [{ delaySeconds: 0, durationSeconds: 0.4, volume: 0.035 }];
  if (sound === "finish") return [
    { delaySeconds: 0, durationSeconds: 0.65, volume: 0.065 },
    { delaySeconds: 0.32, durationSeconds: 0.65, volume: 0.065 },
  ];
  return [{ delaySeconds: 0, durationSeconds: 0.65, volume: 0.065 }];
}
