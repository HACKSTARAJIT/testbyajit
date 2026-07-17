import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, ShieldCheck, Cloud } from "lucide-react";
import pbLogo from "@/assets/pb-logo.png";

const APP_VERSION = "2.0.0";

export default function About() {
  return (
    <div className="mx-auto max-w-2xl space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" asChild><Link to="/dashboard"><ArrowLeft className="mr-1 h-4 w-4" /> Back to Home</Link></Button>

      <div className="glass-card rounded-3xl p-8 text-center">
        <img src={pbLogo} alt="AJIT 360 logo" width={96} height={96} loading="lazy" className="mx-auto h-24 w-24 drop-shadow" />
        <h1 className="mt-4 text-3xl font-bold gradient-text">AJIT 360</h1>
        <p className="mt-2 text-muted-foreground">A premium, intelligent study platform — read PDFs, attempt tests, and let the app auto-build your personalised revision from every mistake.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Feature icon={Sparkles} title="Smart Revision" text="Auto-generated Wrong & Skipped tests after every attempt." />
        <Feature icon={Cloud} title="Cloud Sync" text="Everything saved to your account, on any device." />
        <Feature icon={ShieldCheck} title="Mastery Tracking" text="Questions master after 2 correct revisions." />
      </div>

      <Card>
        <CardContent className="space-y-2 p-6 text-sm">
          <Row label="Developer" value="Ajit Singh" />
          <Row label="Version" value={APP_VERSION} />
          <Row label="Copyright" value={`© ${new Date().getFullYear()} AJIT 360`} />
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Designed &amp; Developed by Ajit Singh</p>
    </div>
  );
}

function Feature({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-2 p-5 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-royal text-white"><Icon className="h-5 w-5" /></div>
        <p className="font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-2 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
