"use client";

import { useCallback, useEffect, useRef } from "react";
import { BLOCK_TIMER_AUDIO, type BlockTimerSound } from "@/lib/block-timer-sounds";

export function useWorkoutTimerAudio(sounds: readonly BlockTimerSound[] = ["work", "rest", "finish"]) {
  const audioRef = useRef<Partial<Record<BlockTimerSound, HTMLAudioElement>>>({});
  const soundsKey = sounds.join(",");

  useEffect(() => {
    const audio = soundsKey.split(",").filter(Boolean).reduce<Partial<Record<BlockTimerSound, HTMLAudioElement>>>((result, sound) => {
      const typedSound = sound as BlockTimerSound;
      const item = new Audio(BLOCK_TIMER_AUDIO[typedSound]);
      item.preload = "auto";
      item.volume = 1;
      item.load();
      result[typedSound] = item;
      return result;
    }, {});
    audioRef.current = audio;
    return () => {
      Object.values(audio).forEach((item) => { item.pause(); item.removeAttribute("src"); item.load(); });
      audioRef.current = {};
    };
  }, [soundsKey]);

  const prime = useCallback((sound: BlockTimerSound) => {
    try {
      const selected = audioRef.current[sound];
      if (!selected) return;
      selected.muted = true;
      void selected.play().then(() => {
        selected.pause();
        selected.currentTime = 0;
        selected.muted = false;
      }).catch(() => { selected.muted = false; });
    } catch { /* El cronómetro funciona aunque el navegador rechace audio. */ }
  }, []);

  const feedback = useCallback((sound: BlockTimerSound, vibrate = true) => {
    try {
      const selected = audioRef.current[sound];
      if (selected) {
        Object.values(audioRef.current).forEach((item) => {
          if (item !== selected) { item.pause(); item.currentTime = 0; }
        });
        selected.pause();
        selected.currentTime = 0;
        selected.muted = false;
        void selected.play().catch(() => undefined);
      }
    } catch { /* El cronómetro funciona aunque el navegador rechace audio. */ }
    if (vibrate) {
      try { navigator.vibrate?.(sound === "finish" ? [45, 250, 45] : sound === "work" ? 45 : 25); } catch { /* La vibración es opcional. */ }
    }
  }, []);

  return { feedback, prime };
}
