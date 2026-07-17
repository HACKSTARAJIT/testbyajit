import { Link } from "react-router-dom";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, ClipboardList, Trophy, ArrowRight } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [user, loading, navigate]);

  const features = [
    { icon: BookOpen, title: "Chapter-wise Notes", desc: "विषय और अध्याय अनुसार PDF व नोट्स।" },
    { icon: ClipboardList, title: "Timed Practice Tests", desc: "MCQ tests with auto scoring & timer." },
    { icon: Trophy, title: "Track Progress", desc: "अपने परिणाम और प्रगति देखें।" },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-hero">
            <GraduationCap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold font-display">Practice Book <span className="text-secondary">By Ajit</span></span>
        </div>
        <Button asChild><Link to="/auth">Login / Sign Up</Link></Button>
      </header>

      <section className="container py-16 text-center md:py-24">
        <span className="inline-block rounded-full bg-muted px-4 py-1 text-sm font-medium text-primary">प्रतियोगी परीक्षा तैयारी मंच</span>
        <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
          Crack your exam with <span className="gradient-text">chapter-wise</span> study & tests
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          अध्याय अनुसार नोट्स पढ़ें, PDF डाउनलोड करें और अभ्यास टेस्ट दें — सब एक ही जगह।
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get Started <ArrowRight className="ml-1 h-4 w-4" /></Link></Button>
        </div>
      </section>

      <section className="container grid gap-6 pb-20 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary">
              <f.icon className="h-6 w-6 text-primary-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Index;
