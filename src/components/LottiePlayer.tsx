import { useEffect, useRef } from "react";
import lottie, { type AnimationItem } from "lottie-web";

/** Lightweight Lottie (.json) renderer used by intro + feedback animations. */
export function LottiePlayer({
  src,
  loop = true,
  className,
  onComplete,
}: {
  src: string;
  loop?: boolean;
  className?: string;
  onComplete?: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    let anim: AnimationItem | null = null;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(src);
        const animationData = await res.json();
        if (cancelled || !host.current) return;
        anim = lottie.loadAnimation({
          container: host.current,
          renderer: "svg",
          loop,
          autoplay: true,
          animationData,
        });
        if (onComplete) anim.addEventListener("complete", onComplete);
      } catch {
        /* failsafe: show nothing */
      }
    })();

    return () => {
      cancelled = true;
      anim?.destroy();
    };
  }, [src, loop, onComplete]);

  return <div ref={host} className={className} aria-hidden />;
}
