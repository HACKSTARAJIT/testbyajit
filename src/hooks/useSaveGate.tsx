import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LogIn, Cloud } from "lucide-react";

interface SaveGateContextType {
  /** Runs `action` only for signed-in users. Guests see the sign-in prompt. Returns true if allowed. */
  guard: (action?: () => void) => boolean;
}

const SaveGateContext = createContext<SaveGateContextType | undefined>(undefined);

export function SaveGateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const guard = useCallback((action?: () => void) => {
    if (user) {
      action?.();
      return true;
    }
    setOpen(true);
    return false;
  }, [user]);

  return (
    <SaveGateContext.Provider value={{ guard }}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary">
              <Cloud className="h-6 w-6 text-primary-foreground" />
            </div>
            <DialogTitle className="text-center">Sign in to save your progress</DialogTitle>
            <DialogDescription className="text-center">
              Please sign in to save your progress and access it from any device.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button className="w-full" onClick={() => { setOpen(false); navigate("/auth"); }}>
              <LogIn className="mr-1 h-4 w-4" /> Sign In
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setOpen(false)}>
              Continue as Guest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SaveGateContext.Provider>
  );
}

export function useSaveGate() {
  const ctx = useContext(SaveGateContext);
  if (!ctx) throw new Error("useSaveGate must be used within SaveGateProvider");
  return ctx;
}
