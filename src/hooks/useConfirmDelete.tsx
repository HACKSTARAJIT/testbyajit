import * as React from "react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type ConfirmDeleteOptions = {
  /** What is being removed, e.g. "Chapter: Algebra". Shown in the first dialog. */
  itemLabel?: string;
  /** Optional extra context for the first dialog. */
  description?: string;
  /** Label of the final destructive button. */
  confirmLabel?: string;
};

type Pending = ConfirmDeleteOptions & { resolve: (ok: boolean) => void };

const ConfirmDeleteContext = React.createContext<
  ((options?: ConfirmDeleteOptions) => Promise<boolean>) | null
>(null);

/**
 * Two-step confirmation for every destructive action (delete / reset / clear all).
 * Usage:  if (!(await confirmDelete({ itemLabel: "Chapter: Algebra" }))) return;
 */
export function useConfirmDelete() {
  const ctx = React.useContext(ConfirmDeleteContext);
  if (!ctx) throw new Error("useConfirmDelete must be used inside <ConfirmDeleteProvider>");
  return ctx;
}

export function ConfirmDeleteProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null);
  const [step, setStep] = React.useState<1 | 2>(1);

  const confirmDelete = React.useCallback(
    (options: ConfirmDeleteOptions = {}) =>
      new Promise<boolean>((resolve) => {
        setStep(1);
        setPending({ ...options, resolve });
      }),
    [],
  );

  // Cancel, Escape, Back and outside-clicks all resolve to "do nothing".
  const cancel = React.useCallback(() => {
    setPending((p) => { p?.resolve(false); return null; });
    setStep(1);
  }, []);

  const accept = React.useCallback(() => {
    setPending((p) => { p?.resolve(true); return null; });
    setStep(1);
  }, []);

  React.useEffect(() => {
    if (!pending) return;
    const onPop = () => cancel();
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [pending, cancel]);

  const open = pending !== null;
  const confirmLabel = pending?.confirmLabel ?? "DELETE PERMANENTLY";

  return (
    <ConfirmDeleteContext.Provider value={confirmDelete}>
      {children}
      <AlertDialog open={open} onOpenChange={(v) => { if (!v) cancel(); }}>
        <AlertDialogContent className="rounded-2xl">
          {step === 1 ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>क्या आप इसे Delete करना चाहते हैं?</AlertDialogTitle>
                <AlertDialogDescription>
                  {pending?.itemLabel ? <span className="block font-medium text-foreground">{pending.itemLabel}</span> : null}
                  {pending?.description ?? "आगे बढ़ने पर एक अंतिम पुष्टि माँगी जाएगी।"}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancel}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => { e.preventDefault(); setStep(2); }}
                >
                  Continue
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>⚠️ अंतिम पुष्टि</AlertDialogTitle>
                <AlertDialogDescription>
                  {pending?.itemLabel ? <span className="block font-medium text-foreground">{pending.itemLabel}</span> : null}
                  यह data delete होने के बाद वापस नहीं लाया जा सकेगा। क्या आप वास्तव में इसे delete करना चाहते हैं?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={cancel}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={accept}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {confirmLabel}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmDeleteContext.Provider>
  );
}
