import { useDeviceExperience } from "@/hooks/useDeviceExperience";

export function useIsMobile() {
  const { experience } = useDeviceExperience();
  return experience === "mobile";
}
