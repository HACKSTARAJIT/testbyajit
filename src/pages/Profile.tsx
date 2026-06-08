import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock, BookOpen, Save, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export default function Profile() {
  const { user, isAdmin } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const [profile, views] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user!.id).maybeSingle(),
        supabase.from("chapter_views")
          .select("viewed_at, chapters(id, name, name_hi, subject_id, subjects(name))")
          .eq("user_id", user!.id)
          .order("viewed_at", { ascending: false })
          .limit(10),
      ]);
      setName(profile.data?.display_name ?? "");
      setRecent(views.data ?? []);
    })();
  }, [user]);

  const saveName = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ display_name: name }).eq("id", user!.id);
    if (error) toast.error(error.message); else toast.success("Profile updated / प्रोफ़ाइल सहेजी गई");
    setSaving(false);
  };

  const initials = (name || user?.email || "ST").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">मेरी प्रोफ़ाइल / My Profile</h1>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
          <Avatar className="h-16 w-16">
            <AvatarFallback className="bg-gradient-hero text-lg text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <p className="font-semibold">{name || "Student"}</p>
              <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Student"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground"><Trophy className="h-4 w-4" /> {attempts} test attempt(s)</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Edit Name / नाम बदलें</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label>Display Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </div>
          <Button onClick={saveName} disabled={saving}><Save className="mr-1 h-4 w-4" /> Save</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Clock className="h-5 w-5 text-primary" /> हाल ही में देखे अध्याय / Recently Viewed Chapters</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No chapters viewed yet. Start exploring subjects!</p>
          ) : (
            recent.map((r) => r.chapters && (
              <Link key={r.chapters.id} to={`/subjects/${r.chapters.subject_id}`}>
                <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.chapters.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {r.chapters.subjects?.name} • {new Date(r.viewed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
