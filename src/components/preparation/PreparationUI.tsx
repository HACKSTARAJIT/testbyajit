import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Target, BarChart3, Brain } from 'lucide-react';

export function PreparationNav() {
  return <nav aria-label="Preparation pages" className="flex flex-wrap gap-2 border-b pb-4">
    {[[ '/cgl-tier2-command-center', 'Command Center', Target ], ['/external-mock-tracker', 'External Mocks', BarChart3], ['/smart-revision-scheduler', 'Revision', Brain]].map(([to, label, Icon]) => {
      const Symbol = Icon as typeof Target; return <Button key={String(to)} variant="outline" size="sm" asChild><Link to={String(to)}><Symbol className="mr-2 h-4 w-4" />{String(label)}</Link></Button>;
    })}
  </nav>;
}
export function PreparationState({ loading, error, signedIn, retry }: { loading: boolean; error: Error | null; signedIn: boolean; retry: () => void }) {
  if (!signedIn) return <div className="py-10 text-center"><p className="mb-4">Sign in to keep your preparation private and saved.</p><Button asChild><Link to="/auth">Sign In</Link></Button></div>;
  if (loading) return <div className="flex min-h-48 items-center justify-center" role="status"><Loader2 className="h-6 w-6 animate-spin text-primary" /><span className="ml-2">Loading preparation…</span></div>;
  if (error) return <div role="alert" className="space-y-3 py-8 text-destructive"><p>{error.message}</p><Button variant="outline" onClick={retry}>Retry</Button></div>;
  return null;
}
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
export function NumericField({ label, value, onChange, min, max, step = 'any' }: { label: string; value: number | null; onChange: (value: number | null) => void; min?: number; max?: number; step?: number | string }) {
  return <Field label={label}><Input type="number" min={min} max={max} step={step} value={value ?? ''} onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))} /></Field>;
}
export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return <div className="min-w-0 border-l-2 border-primary pl-3"><p className="text-xs text-muted-foreground">{label}</p><p className="break-words text-xl font-semibold">{value}</p>{detail && <p className="text-xs text-muted-foreground">{detail}</p>}</div>;
}