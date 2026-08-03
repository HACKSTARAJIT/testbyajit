import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardList, FileText, ChevronRight } from "lucide-react";

export default function ChapterHub() {
  const { id = "", chapterId = "" } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("Chapter");

  useEffect(() => {
    (async () => {
      if (chapterId === "general") { setName("General"); return; }
      const { data } = await supabase.from("chapters").select("name").eq("id", chapterId).maybeSingle();
      if (data?.name) setName(data.name);
    })();
  }, [chapterId]);

  const cards = [
    { to: `/subjects/${id}/chapter/${chapterId}/tests`, label: "Tests", hi: "टेस्ट", icon: ClipboardList, cls: "bg-gradient-exam" },
    { to: `/subjects/${id}/chapter/${chapterId}/pdfs`, label: "PDFs", hi: "पीडीएफ", icon: FileText, cls: "bg-gradient-warm" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <Button variant="ghost" size="sm" onClick={() => navigate(`/subjects/${id}`)}>
        <ArrowLeft className="mr-1 h-4 w-4" /> Chapters
      </Button>

      <h1 className="text-2xl font-bold">{name}</h1>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((c) => (
          <Link key={c.label} to={c.to}>
            <Card className="group h-full transition-shadow hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-6">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${c.cls}`}>
                  <c.icon className="h-6 w-6 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold">{c.label}</h3>
                  <p className="text-sm text-muted-foreground">{c.hi}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
