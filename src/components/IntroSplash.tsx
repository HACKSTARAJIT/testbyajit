import { useEffect, useState } from "react";
import { APP_NAME } from "@/lib/brand";
import { brandingUrl, kindOfPath, loadIntro, type AppIntroRow } from "@/lib/branding";
import { LottiePlayer } from "@/components/LottiePlayer";
import { Button } from "@/components/ui/button";

const SEEN_KEY = "ajit360-intro-played";

/**
 * Branded intro that plays once per app launch (tab session) before the app UI.
 * If no intro is uploaded or it is disabled, nothing renders and there is no delay.
 */
export function IntroSplash() {
  const [intro, setIntro] = useState<AppIntroRow | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [show, setShow] = useState(() => !sessionStorage.getItem(SEEN_KEY));

  useEffect(() => {
    if (!show) return;
    let alive = true;
    (async () => {
      const row = await loadIntro();
      if (!alive) return;
      if (!row?.enabled || !row.file_path) {
        finish();
        return;
      }
      const signed = await brandingUrl(row.file_path);
      if (!alive) return;
      if (!signed) {
        finish();
        return;
      }
      setIntro(row);
      setUrl(signed);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  useEffect(() => {
    if (!url || !intro) return;
    const ms = Math.max(1000, Number(intro.duration_seconds || 4) * 1000);
    const t = window.setTimeout(finish, ms);
    return () => window.clearTimeout(t);
  }, [url, intro]);

  function finish() {
    sessionStorage.setItem(SEEN_KEY, "1");
    setShow(false);
  }

  if (!show || !url || !intro) return null;
  const kind = kindOfPath(intro.file_path ?? "");

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-background">
      {kind === "lottie" ? (
        <LottiePlayer src={url} className="h-full max-h-[70vh] w-full max-w-[90vw]" />
      ) : kind === "gif" ? (
        <img src={url} alt={`${APP_NAME} intro`} className="max-h-full max-w-full object-contain" />
      ) : (
        <video
          src={url}
          autoPlay
          muted
          playsInline
          onEnded={finish}
          className="max-h-full max-w-full object-contain"
        />
      )}
      {intro.skip_enabled && (
        <Button
          size="sm"
          variant="secondary"
          className="absolute bottom-8 right-6 rounded-full"
          onClick={finish}
        >
          Skip
        </Button>
      )}
    </div>
  );
}
