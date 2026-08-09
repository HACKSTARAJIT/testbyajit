import { cn } from "@/lib/utils";
import { Shuffle } from "lucide-react";

/**
 * Premium, minimal test setting shown BEFORE a test starts.
 * Default is always OFF → original sequence.
 */
export function ShuffleModeSetting({
  value,
  onChange,
  className,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  className?: string;
}) {
  return (
    <div className={cn("test-glass rounded-3xl p-4", className)}>
      <div className="mb-3 flex items-center gap-2">
        <Shuffle className="h-4 w-4 text-primary" />
        <p className="text-sm font-bold">Test Settings</p>
        <span className="ml-auto text-[10px] uppercase tracking-wide text-muted-foreground">
          Question Order
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <OrderOption
          active={!value}
          title="Original Sequence"
          desc="Questions and options exactly as created."
          onClick={() => onChange(false)}
        />
        <OrderOption
          active={value}
          title="🔀 Shuffle Mode"
          desc="Shuffle Questions + Options."
          onClick={() => onChange(true)}
        />
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        {value
          ? "Questions and options will be randomized for this attempt. Your answers, scoring and explanations stay exactly the same."
          : "Default: OFF — the test will appear in its original order."}
      </p>
    </div>
  );
}

function OrderOption({
  active, title, desc, onClick,
}: { active: boolean; title: string; desc: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10"
          : "border-white/10 bg-white/5 hover:border-primary/40",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
          active ? "border-primary" : "border-muted-foreground/50",
        )}
      >
        {active && <span className="h-2 w-2 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-[11px] text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}
