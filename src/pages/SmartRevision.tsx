import { useNavigate } from "react-router-dom";
import { Brain, ChevronRight, NotebookPen, XCircle } from "lucide-react";

export default function SmartRevision() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-royal p-6 text-white shadow-lg">
        <Brain className="absolute -right-4 -top-4 h-28 w-28 opacity-15" />
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-white/20 p-3 backdrop-blur-sm"><Brain className="h-7 w-7" /></div>
          <div>
            <h1 className="font-display text-2xl font-bold">🧠 Smart Revision</h1>
            <p className="text-sm text-white/85">Practice → Instant Feedback → AJIT AI → Next Revision</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        <button
          onClick={() => navigate("/smart-revision/wrong")}
          className="btn-ripple relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 via-red-600 to-orange-500 p-6 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
        >
          <XCircle className="absolute -right-5 -bottom-5 h-28 w-28 opacity-15" />
          <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-sm"><XCircle className="h-7 w-7" /></div>
          <div className="flex-1">
            <p className="text-xl font-bold">❌ Wrong Questions</p>
            <p className="mt-1 text-xs text-white/85">
              AJIT 360 tests में जो questions Wrong या Skip हुए — Subject → Chapter → Practice Test
            </p>
          </div>
          <ChevronRight className="h-6 w-6" />
        </button>

        <button
          onClick={() => navigate("/mock-mistakes")}
          className="btn-ripple relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-left text-white shadow-lg transition-transform hover:scale-[1.01]"
        >
          <NotebookPen className="absolute -right-5 -bottom-5 h-28 w-28 opacity-15" />
          <div className="rounded-2xl bg-white/20 p-4 backdrop-blur-sm"><NotebookPen className="h-7 w-7" /></div>
          <div className="flex-1">
            <p className="text-xl font-bold">📝 Mock Mistakes</p>
            <p className="mt-1 text-xs text-white/85">
              AI mock analysis reports से imported questions — Subject → Mock → Practice Test
            </p>
          </div>
          <ChevronRight className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
}
