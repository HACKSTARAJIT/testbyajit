import { useEffect, useRef, useState } from "react";

export const CELEBRATION_DURATION = 1400;
export const FIREWORKS_SOUND_KEY = "practice-with-ajit:fireworks-sound";
export type AnswerReaction = { questionId: string; correct: boolean };

// Short, quiet synthesized sparkle played through HTML media (not an audio
// context), so the browser/device media volume remains in control.
function sparkleSound() {
  const rate = 22050;
  const count = Math.floor(rate * 0.45);
  const buffer = new ArrayBuffer(44 + count * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, "RIFF"); view.setUint32(4, 36 + count * 2, true); text(8, "WAVE");
  text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, "data"); view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const t = i / rate;
    const sample = (Math.sin(t * 2 * Math.PI * 1046) + Math.sin(t * 2 * Math.PI * 1568) * 0.4) * Math.exp(-t * 12) * Math.min(t * 100, 1);
    view.setInt16(44 + i * 2, sample * 4500, true);
  }
  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

/** Event-only presentation; never reads or validates a correct answer. */
export function useAnswerCelebration(activeQuestionId?: string, active = true) {
  const [reaction, setReaction] = useState<AnswerReaction | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try { return localStorage.getItem(FIREWORKS_SOUND_KEY) === "on"; } catch { return false; }
  });
  const seen = useRef(new Set<string>());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const audio = useRef<HTMLAudioElement>();
  const audioUrl = useRef<string>();
  const clear = () => {
    clearTimeout(timer.current);
    setReaction(null);
    audio.current?.pause();
  };
  useEffect(() => {
    clear();
    return () => { clearTimeout(timer.current); audio.current?.pause(); };
  }, [activeQuestionId, active]);
  useEffect(() => () => {
    clearTimeout(timer.current);
    audio.current?.pause();
    if (audioUrl.current) URL.revokeObjectURL(audioUrl.current);
  }, []);
  const trigger = (questionId: string, correct: boolean) => {
    if (!active || questionId !== activeQuestionId || seen.current.has(questionId)) return;
    seen.current.add(questionId);
    clear();
    setReaction({ questionId, correct });
    timer.current = setTimeout(() => setReaction(null), CELEBRATION_DURATION);
    if (correct && soundEnabled && document.visibilityState === "visible") {
      try {
        if (!audio.current) {
          audioUrl.current = sparkleSound();
          audio.current = new Audio(audioUrl.current);
          audio.current.volume = 0.35;
        }
        audio.current.currentTime = 0;
        void audio.current.play().catch(() => undefined);
      } catch { /* Unsupported media must never interrupt answering. */ }
    }
  };
  const toggleSound = () => setSoundEnabled((enabled) => {
    const next = !enabled;
    try { localStorage.setItem(FIREWORKS_SOUND_KEY, next ? "on" : "off"); } catch { /* optional setting */ }
    if (!next) audio.current?.pause();
    return next;
  });
  const reset = () => { seen.current.clear(); clear(); };
  return { reaction: active && reaction?.questionId === activeQuestionId ? reaction : null, trigger, reset, soundEnabled, toggleSound };
}