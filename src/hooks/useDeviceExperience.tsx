import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type DevicePreference = "mobile" | "desktop" | "auto";
export type DeviceExperience = "mobile" | "tablet" | "desktop";

const STORAGE_KEY = "pwa-device-preference";

function readPreference(): DevicePreference | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "mobile" || value === "desktop" || value === "auto" ? value : null;
}

function experienceFor(preference: DevicePreference, width: number): DeviceExperience {
  if (preference === "mobile") return "mobile";
  if (preference === "desktop") return "desktop";
  if (width < 768) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

type DeviceContextValue = {
  preference: DevicePreference | null;
  experience: DeviceExperience;
  viewportWidth: number;
  needsSetup: boolean;
  setPreference: (preference: DevicePreference) => void;
};

const DeviceContext = createContext<DeviceContextValue | null>(null);

export function DeviceExperienceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<DevicePreference | null>(readPreference);
  const [viewportWidth, setViewportWidth] = useState(() => typeof window === "undefined" ? 1024 : window.innerWidth);

  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const experience = experienceFor(preference ?? "auto", viewportWidth);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.devicePreference = preference ?? "unset";
    root.dataset.deviceExperience = experience;
  }, [preference, experience]);

  const setPreference = (next: DevicePreference) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setPreferenceState(next);
  };

  const value = useMemo(() => ({
    preference,
    experience,
    viewportWidth,
    needsSetup: preference === null,
    setPreference,
  }), [preference, experience, viewportWidth]);

  return <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>;
}

export function useDeviceExperience() {
  const value = useContext(DeviceContext);
  if (!value) throw new Error("useDeviceExperience must be used within DeviceExperienceProvider");
  return value;
}
