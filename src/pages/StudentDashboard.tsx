import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { useHomeData } from "@/components/home/useHomeData";
import {
  HomeHero, TodaysMission, QuickStats, AIRecommendation, WeeklyProgress,
  AchievementsRow, DailyChallenge, QuickActions, GoalsPanel, RecentActivity, OnboardingCards, HomeSkeleton,
} from "@/components/home/HomeSections";
import FloatingAIButton from "@/components/home/FloatingAIButton";

const fmtSize = (bytes?: number | null) => {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export default function StudentDashboard() {
  const { user } = useAuth();
  const home = useHomeData(user?.id);
  const [release, setRelease] = useState<any | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    supabase.from("app_release").select("*").order("updated_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setRelease(data ?? null));
  }, []);

  const continueTo = useMemo(() => {
    const a = home.activity[0];
    if (!a) return null;
    const path = a.subject_id ? `/subjects/${a.subject_id}` : "/subjects";
    return { path, label: a.title ?? a.item_type };
  }, [home.activity]);

  const handleDownload = async () => {
    if (!release?.file_path) { toast.error("APK अभी उपलब्ध नहीं है / App not available yet"); return; }
    setDownloading(true);
    const url = await getSignedUrl(release.file_path, "app-releases");
    setDownloading(false);
    if (!url) { toast.error("Download failed, try again"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = `ajit360-${release.version ?? "app"}.apk`;
    document.body.appendChild(a); a.click(); a.remove();
  };

  const isNewStudent = !!user && !home.loading && home.testsCompleted === 0 && home.activity.length === 0;

  if (!user) {
    return (
      <div className="py-20 text-center text-muted-foreground">
        <p>Please sign in to view your dashboard.</p>
        <Link to="/auth"><Button className="mt-4">Sign in</Button></Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      {home.loading ? <HomeSkeleton /> : (
        <>
          <HomeHero data={home} continueTo={continueTo} />
          {isNewStudent ? <OnboardingCards /> : (
            <>
              <TodaysMission data={home} />
              <QuickStats data={home} />
              <AIRecommendation data={home} />
              <DailyChallenge data={home} />
              <WeeklyProgress data={home} />
              <QuickActions />
              <GoalsPanel data={home} />
              <AchievementsRow data={home} />
              <RecentActivity data={home} />
            </>
          )}
        </>
      )}

      <Card className="border-secondary/30 bg-gradient-to-br from-secondary/10 to-primary/5">
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-warm text-secondary-foreground shadow-md">
              <Smartphone className="h-6 w-6" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-semibold">📱 AJIT 360 App</p>
              <p className="text-xs text-muted-foreground">
                Version {release?.version ?? "1.0.0"}
                {fmtSize(release?.file_size) && ` • ${fmtSize(release?.file_size)}`}
                {release?.updated_at && ` • Updated ${new Date(release.updated_at).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <Button onClick={handleDownload} disabled={downloading} size="lg" className="w-full bg-gradient-warm shadow-md hover:opacity-90 sm:w-auto">
            <Download className="mr-1 h-5 w-5" /> {downloading ? "Preparing..." : "Download Android App"}
          </Button>
        </CardContent>
      </Card>

      <FloatingAIButton />
    </div>
  );
}
