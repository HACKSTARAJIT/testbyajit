import { Laptop, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_LOGO, APP_LOGO_ALT, APP_NAME } from "@/lib/brand";
import { useDeviceExperience, type DevicePreference } from "@/hooks/useDeviceExperience";

const choices: Array<{
  value: Exclude<DevicePreference, "auto">;
  title: string;
  description: string;
  Icon: typeof Smartphone;
}> = [
  { value: "mobile", title: "MOBILE", description: "Mobile के लिए optimized experience", Icon: Smartphone },
  { value: "desktop", title: "LAPTOP / DESKTOP", description: "बड़ी screen के लिए optimized experience", Icon: Laptop },
];

export function DeviceSetup() {
  const { needsSetup, setPreference } = useDeviceExperience();
  if (!needsSetup) return null;

  return (
    <div className="fixed inset-0 z-[200] overflow-y-auto bg-background px-4 py-8 text-foreground sm:px-6">
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center">
        <img src={APP_LOGO} alt={APP_LOGO_ALT} className="h-20 w-20 rounded-2xl shadow-lg sm:h-24 sm:w-24" />
        <p className="mt-4 text-center font-display text-xl font-extrabold sm:text-2xl">{APP_NAME}</p>
        <h1 className="mt-7 max-w-xl text-center text-2xl font-bold leading-relaxed sm:text-3xl">
          आप AJIT 360 किस device पर इस्तेमाल कर रहे हैं?
        </h1>
        <div className="mt-8 grid w-full gap-4 md:grid-cols-2">
          {choices.map(({ value, title, description, Icon }) => (
            <Button
              key={value}
              type="button"
              variant="outline"
              onClick={() => setPreference(value)}
              className="h-auto min-h-44 w-full flex-col gap-4 whitespace-normal border-2 bg-card p-6 text-center shadow-md transition-transform hover:-translate-y-1 hover:border-primary hover:bg-primary/5"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-8 w-8" />
              </span>
              <span className="font-display text-lg font-extrabold">{title}</span>
              <span className="text-sm font-normal text-muted-foreground">{description}</span>
            </Button>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">इसे बाद में Profile → Display / Device Experience से बदला जा सकता है।</p>
      </div>
    </div>
  );
}
