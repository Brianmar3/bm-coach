export type BlockTimerSound = "work" | "rest" | "finish";

export const BLOCK_TIMER_AUDIO: Record<BlockTimerSound, string> = {
  work: "/audio/workout-start.mp4",
  rest: "/audio/rest-start.m4a",
  finish: "/audio/workout-finish.m4a",
};

export function phaseTransitionSound(previousStep: string, currentStep: string, resting: boolean): BlockTimerSound | null {
  if (!previousStep || !currentStep || previousStep === currentStep) return null;
  return resting ? "rest" : "work";
}
