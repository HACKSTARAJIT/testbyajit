import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, MessageCircle, HelpCircle, CalendarClock, Gauge, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function FloatingAIButton() {
  const [open, setOpen] = useState(false);
  const links = [
    { to: "/ai-coach", icon: MessageCircle, label: "Ask AI" },
    { to: "/ai-mock-analyzer", icon: HelpCircle, label: "Analyze Mock" },
    { to: "/ai-performance", icon: CalendarClock, label: "Study Plan" },
    { to: "/performance", icon: Gauge, label: "Performance" },
  ];
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 bg-background/40 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
      )}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6">
        {open && (
          <div className="flex flex-col items-end gap-2 animate-scale-in">
            {links.map(l => (
              <Link key={l.to} to={l.to} onClick={() => setOpen(false)}>
                <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-2 shadow-lg transition-all hover:-translate-y-0.5">
                  <span className="text-xs font-medium">{l.label}</span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground">
                    <l.icon className="h-4 w-4" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        <Button
          size="icon"
          aria-label={open ? "Close AJIT AI menu" : "Open AJIT AI"}
          onClick={() => setOpen(o => !o)}
          className="h-14 w-14 rounded-full bg-gradient-primary shadow-2xl transition-transform hover:scale-105"
        >
          {open ? <X className="h-6 w-6" /> : <Sparkles className="h-6 w-6" />}
        </Button>
      </div>
    </>
  );
}
