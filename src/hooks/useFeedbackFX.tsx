import { useCallback, useEffect, useRef, useState } from "react";
import {
  brandingUrl,
  categoryEnabled,
  kindOfPath,
  loadFeedbackBundle,
  pick,
  type FeedbackBundle,
  type FeedbackMediaRow,
} from "@/lib/branding";
import { LottiePlayer } from "@/components/LottiePlayer";

type Visual = { url: string; kind: "gif" | "lottie" | "video" } | null;

/**
 * Voice + animation feedback for Practice Mode.
 * Failsafe by design: if nothing is uploaded / disabled, everything is a no-op.
 */
export function useFeedbackFX() {
  const [bundle, setBundle] = useState<FeedbackBundle>({ settings: null, media: [] });
  const [visual, setVisual] = useState<Visual>(null);
  const audioCache = useRef(new Map<string, HTMLAudioElement>());
  const firstWrongShown = useRef(false);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const b = await loadFeedbackBundle();
      if (!alive) return;
      setBundle(b);
      // preload media so playback starts instantly
      for (const m of b.media.filter((x) => x.enabled)) {
        const url = await brandingUrl(m.file_path);
        if (!url) continue;
        if (m.media_type === "voice") {
          const a = new Audio(url);
          a.preload = "auto";
          audioCache.current.set(m.file_path, a);
        } else if (kindOfPath(m.file_path) === "gif") {
          const img = new Image();
          img.src = url;
        }
      }
    })();
    return () => {
      alive = false;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, []);

  const of = useCallback(
    (category: string, type: "voice" | "animation"): FeedbackMediaRow[] =>
      bundle.media.filter((m) => m.enabled && m.category === category && m.media_type === type),
    [bundle.media],
  );

  const play = useCallback(
    async (category: string) => {
      const s = bundle.settings;
      if (!s || !categoryEnabled(s, category)) return;
      const random = s.random_playback;

      if (s.voice_enabled) {
        const voice = pick(of(category, "voice"), random);
        if (voice) {
          const url = await brandingUrl(voice.file_path);
          if (url) {
            const el = audioCache.current.get(voice.file_path) ?? new Audio(url);
            audioCache.current.set(voice.file_path, el);
            el.volume = Math.min(Math.max(Number(s.volume ?? 0.8), 0), 1);
            el.currentTime = 0;
            el.play().catch(() => {});
          }
        }
      }

      if (s.animation_enabled) {
        if (category === "wrong") {
          if (firstWrongShown.current) return; // only first wrong answer shows a GIF
          firstWrongShown.current = true;
        }
        const anim = pick(of(category, "animation"), random);
        if (!anim) return;
        const url = await brandingUrl(anim.file_path);
        if (!url) return;
        const kind = kindOfPath(anim.file_path);
        setVisual({ url, kind: kind === "audio" ? "gif" : kind });
        if (hideTimer.current) window.clearTimeout(hideTimer.current);
        hideTimer.current = window.setTimeout(
          () => setVisual(null),
          Math.max(400, s.animation_duration_ms ?? 2000),
        );
      }
    },
    [bundle.settings, of],
  );

  const resetSession = useCallback(() => {
    firstWrongShown.current = false;
  }, []);

  const overlay = visual ? (
    <div className="pointer-events-none fixed inset-0 z-[80] flex items-center justify-center">
      {visual.kind === "lottie" ? (
        <LottiePlayer src={visual.url} className="h-56 w-56 animate-scale-in" />
      ) : visual.kind === "video" ? (
        <video
          src={visual.url}
          autoPlay
          muted
          playsInline
          className="h-56 w-56 animate-scale-in rounded-3xl object-contain drop-shadow-2xl"
        />
      ) : (
        <img
          src={visual.url}
          alt=""
          className="h-56 w-56 animate-scale-in object-contain drop-shadow-2xl"
        />
      )}
    </div>
  ) : null;

  return { play, resetSession, overlay };
}
