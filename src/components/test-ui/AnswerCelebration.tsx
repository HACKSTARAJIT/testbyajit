import { type CSSProperties } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FireworksSoundControl({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={onToggle}
    aria-label={`Fireworks sound ${enabled ? "on" : "off"}`} aria-pressed={enabled} title={`Fireworks sound: ${enabled ? "On" : "Off"}`}>
    {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
  </Button>;
}

export function AnswerCelebration() {
  return <span className="answer-celebration" aria-hidden="true">
    {Array.from({ length: 24 }, (_, i) => {
      const angle = (i % 12) * Math.PI / 6;
      const distance = 22 + (i % 4) * 9;
      return <i key={i} className={`answer-particle answer-particle-${i % 4}`} style={{
        "--particle-x": `${Math.cos(angle) * distance}px`,
        "--particle-y": `${Math.sin(angle) * distance}px`,
        "--particle-delay": `${300 + (i % 3) * 45}ms`,
        "--particle-turn": `${90 + i * 37}deg`,
        left: i < 12 ? "12%" : "88%",
      } as CSSProperties} />;
    })}
  </span>;
}