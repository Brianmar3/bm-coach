"use client";

import { useCallback, useEffect, useRef } from "react";
import { BLOCK_TIMER_AUDIO, type BlockTimerSound } from "@/lib/block-timer-sounds";

export function useWorkoutTimerAudio(sounds: readonly BlockTimerSound[] = ["work", "rest", "finish"]) {
  const audioRef = useRef<Partial<Record<BlockTimerSound, HTMLAudioElement>>>({});
  const restFinishPlayingRef = useRef(false);
  const soundsKey = sounds.join(",");

  useEffect(() => {
    const audio = soundsKey.split(",").filter(Boolean).reduce<Partial<Record<BlockTimerSound, HTMLAudioElement>>>((result, sound) => {
      const typedSound = sound as BlockTimerSound;
      const item = new Audio(BLOCK_TIMER_AUDIO[typedSound]);
      item.preload = "auto";
      if (typedSound === "restFinish") {
        const release = () => { restFinishPlayingRef.current = false; };
        item.addEventListener("ended", release);
        item.addEventListener("error", release);
      }
      item.volume = 1;
      item.load();
      result[typedSound] = item;
      return result;
    }, {});
    audioRef.current = audio;
    return () => {
      Object.values(audio).forEach((item) => { item.pause(); item.removeAttribute("src"); item.load(); });
      audioRef.current = {};
      restFinishPlayingRef.current = false;
    };
  }, [soundsKey]);

  const prime = useCallback((sound: BlockTimerSound) => {
    if (sound === "restFinish" && restFinishPlayingRef.current) return;
    try {
      const selected = audioRef.current[sound];
      if (!selected) return;
      selected.muted = true;
      void selected.play().then(() => {
        if (sound === "restFinish" && restFinishPlayingRef.current) return;
        selected.pause();
        selected.currentTime = 0;
        selected.muted = false;
      }).catch(() => { selected.muted = false; });
    } catch { /* El cronómetro funciona aunque el navegador rechace audio. */ }
  }, []);

  const feedback = useCallback((sound: BlockTimerSound, vibrate = true) => {
    // One play contains all three bells. Repeated feedback must not restart it.
    if (sound === "restFinish" && restFinishPlayingRef.current) return;
    try {
      const selected = audioRef.current[sound];
      if (selected) {
        restFinishPlayingRef.current = sound === "restFinish";
        Object.values(audioRef.current).forEach((item) => {
          if (item !== selected) { item.pause(); item.currentTime = 0; }
        });
        selected.pause();
        selected.currentTime = 0;
        selected.muted = false;
        void selected.play().catch(() => { if (sound === "restFinish") restFinishPlayingRef.current = false; });
      }
    } catch { if (sound === "restFinish") restFinishPlayingRef.current = false; /* El cronómetro funciona aunque el navegador rechace audio. */ }
    if (vibrate) {
      try { navigator.vibrate?.(sound === "finish" ? [45, 250, 45] : sound === "work" ? 45 : 25); } catch { /* La vibración es opcional. */ }
    }
  }, []);

  return { feedback, prime };
}
