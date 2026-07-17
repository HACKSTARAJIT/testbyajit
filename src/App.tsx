import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import { SaveGateProvider } from "@/hooks/useSaveGate";
import { Loader2 } from "lucide-react";

// Eagerly-loaded (small / critical-path)
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy-loaded (heavy or secondary routes) — cuts initial JS significantly
const Subjects = lazy(() => import("./pages/Subjects.tsx"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail.tsx"));
const Tests = lazy(() => import("./pages/Tests.tsx"));
const TestRunner = lazy(() => import("./pages/TestRunner.tsx"));
const TestAnalysis = lazy(() => import("./pages/TestAnalysis.tsx"));
const WrongQuestions = lazy(() => import("./pages/WrongQuestions.tsx"));
const SmartRevision = lazy(() => import("./pages/SmartRevision.tsx"));
const SmartRevisionSubject = lazy(() => import("./pages/SmartRevisionSubject.tsx"));
const SmartRevisionChapter = lazy(() => import("./pages/SmartRevisionChapter.tsx"));
const Bookmarks = lazy(() => import("./pages/Bookmarks.tsx"));
const Revision = lazy(() => import("./pages/Revision.tsx"));
const RevisionDashboard = lazy(() => import("./pages/RevisionDashboard.tsx"));
const RevisionRunner = lazy(() => import("./pages/RevisionRunner.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics.tsx"));
const AdminIntelligence = lazy(() => import("./pages/AdminIntelligence.tsx"));
const AIMockAnalyzer = lazy(() => import("./pages/AIMockAnalyzer.tsx"));
const PerformanceIntelligence = lazy(() => import("./pages/PerformanceIntelligence.tsx"));
const AICoach = lazy(() => import("./pages/AICoach.tsx"));
const AICoachChat = lazy(() => import("./pages/AICoachChat.tsx"));
const AIPerformanceCenter = lazy(() => import("./pages/AIPerformanceCenter.tsx"));
const Profile = lazy(() => import("./pages/Profile.tsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-label="Loading page">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

const withLayout = (el: JSX.Element) => (
  <ProtectedRoute>
    <AppLayout>
      <Suspense fallback={<RouteFallback />}>{el}</Suspense>
    </AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <SaveGateProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={withLayout(<Dashboard />)} />
            <Route path="/subjects" element={withLayout(<Subjects />)} />
            <Route path="/subjects/:id" element={withLayout(<SubjectDetail />)} />
            <Route path="/tests" element={withLayout(<Tests />)} />
            <Route path="/test/:id" element={withLayout(<TestRunner />)} />
            <Route path="/analysis" element={withLayout(<TestAnalysis />)} />
            <Route path="/smart-revision" element={withLayout(<SmartRevision />)} />
            <Route path="/smart-revision/subject/:subjectId" element={withLayout(<SmartRevisionSubject />)} />
            <Route path="/smart-revision/subject/:subjectId/chapter/:chapterId" element={withLayout(<SmartRevisionChapter />)} />
            <Route path="/wrong-questions" element={withLayout(<WrongQuestions />)} />
            <Route path="/bookmarks" element={withLayout(<Bookmarks />)} />
            <Route path="/revision" element={withLayout(<Revision />)} />
            <Route path="/revision-dashboard" element={withLayout(<RevisionDashboard />)} />
            <Route path="/revise" element={withLayout(<RevisionRunner />)} />
            <Route path="/revise/:testId" element={withLayout(<RevisionRunner />)} />
            <Route path="/about" element={withLayout(<About />)} />
            <Route path="/profile" element={withLayout(<Profile />)} />
            <Route path="/ai-mock-analyzer" element={withLayout(<AIMockAnalyzer />)} />
            <Route path="/ai-performance-center" element={withLayout(<AIPerformanceCenter />)} />
            <Route path="/performance" element={withLayout(<PerformanceIntelligence />)} />
            <Route path="/ai-coach" element={withLayout(<AICoach />)} />
            <Route path="/ai-coach/chat" element={withLayout(<AICoachChat />)} />
            <Route path="/ai-coach/chat/:threadId" element={withLayout(<AICoachChat />)} />

            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AppLayout>
                    <Suspense fallback={<RouteFallback />}>
                      <Admin />
                    </Suspense>
                  </AppLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/analytics"
              element={
                <AdminRoute>
                  <AppLayout>
                    <Suspense fallback={<RouteFallback />}>
                      <AdminAnalytics />
                    </Suspense>
                  </AppLayout>
                </AdminRoute>
              }
            />
            <Route
              path="/admin/intelligence"
              element={
                <AdminRoute>
                  <AppLayout>
                    <Suspense fallback={<RouteFallback />}>
                      <AdminIntelligence />
                    </Suspense>
                  </AppLayout>
                </AdminRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SaveGateProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
