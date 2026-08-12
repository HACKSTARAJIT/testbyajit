import { useEffect, useState } from "react";
import { APP_NAME, APP_LOGO, APP_LOGO_ALT } from "@/lib/brand";

/** One-time premium splash shown briefly on first app load per tab session. */
export function SplashScreen() {
  const [show, setShow] = useState(() => !sessionStorage.getItem("pb-splash-seen"));

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => {
      sessionStorage.setItem("pb-splash-seen", "1");
      setShow(false);
    }, 1600);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-royal text-white animate-fade-in">
      <img src={APP_LOGO} alt={APP_LOGO_ALT} width={120} height={120} className="h-28 w-28 animate-scale-in drop-shadow-2xl" />
      <h1 className="mt-5 text-3xl font-bold">{APP_NAME}</h1>
      <p className="mt-1 text-sm text-white/80">AI Powered Learning Platform</p>
      <div className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-white/25">
        <div className="h-full w-full origin-left animate-[slide-in-right_1.4s_ease-out] bg-white" />
      </div>
    </div>
  );
}
