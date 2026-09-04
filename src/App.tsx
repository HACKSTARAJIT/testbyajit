import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import { SaveGateProvider } from "@/hooks/useSaveGate";
import { Loader2 } from "lucide-react";
import { IntroSplash } from "@/components/IntroSplash";

// Eagerly-loaded (small / critical-path)
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import NotFound from "./pages/NotFound.tsx";

// Lazy-loaded (heavy or secondary routes) — cuts initial JS significantly
const Subjects = lazy(() => import("./pages/Subjects.tsx"));
const SubjectDetail = lazy(() => import("./pages/SubjectDetail.tsx"));
const ChapterHub = lazy(() => import("./pages/ChapterHub.tsx"));
const ChapterTests = lazy(() => import("./pages/ChapterTests.tsx"));
const ChapterPdfs = lazy(() => import("./pages/ChapterPdfs.tsx"));
const Tests = lazy(() => import("./pages/Tests.tsx"));
const TestRunner = lazy(() => import("./pages/TestRunner.tsx"));
const TestAnalysis = lazy(() => import("./pages/TestAnalysis.tsx"));
const TestMistakeAnalysis = lazy(() => import("./pages/TestMistakeAnalysis.tsx"));
const WrongQuestions = lazy(() => import("./pages/WrongQuestions.tsx"));
const AppTestMistakesSubject = lazy(() => import("./pages/AppTestMistakesSubject.tsx"));
const AppTestMistakesChapter = lazy(() => import("./pages/AppTestMistakesChapter.tsx"));
const AppTestMistakesTest = lazy(() => import("./pages/AppTestMistakesTest.tsx"));
const Bookmarks = lazy(() => import("./pages/Bookmarks.tsx"));
const Revision = lazy(() => import("./pages/Revision.tsx"));
const RevisionDashboard = lazy(() => import("./pages/RevisionDashboard.tsx"));
const StudentDashboard = lazy(() => import("./pages/StudentDashboard.tsx"));
const RevisionRunner = lazy(() => import("./pages/RevisionRunner.tsx"));
const MockRevisionHub = lazy(() => import("./pages/MockRevisionHub.tsx"));
const MockAutoTest = lazy(() => import("./pages/MockAutoTest.tsx"));
const MockMistakes = lazy(() => import("./pages/MockMistakes.tsx"));
const MockMistakesSubject = lazy(() => import("./pages/MockMistakesSubject.tsx"));
const MockMistakesIntelligence = lazy(() => import("./pages/MockMistakesIntelligence.tsx"));
const MockMistakesActionPlan = lazy(() => import("./pages/MockMistakesActionPlan.tsx"));
const MockMistakesActionPractice = lazy(() => import("./pages/MockMistakesActionPractice.tsx"));
const MockMistakesMock = lazy(() => import("./pages/MockMistakesMock.tsx"));
const MockMistakesTest = lazy(() => import("./pages/MockMistakesTest.tsx"));
const MockMistakesTopicTest = lazy(() => import("./pages/MockMistakesTopicTest.tsx"));
const About = lazy(() => import("./pages/About.tsx"));
const Admin = lazy(() => import("./pages/Admin.tsx"));
const AdminAnalytics = lazy(() => import("./pages/AdminAnalytics.tsx"));
const AdminIntelligence = lazy(() => import("./pages/AdminIntelligence.tsx"));
const AdminTestManager = lazy(() => import("./pages/AdminTestManager.tsx"));
const PerformanceIntelligence = lazy(() => import("./pages/PerformanceIntelligence.tsx"));
const AICoach = lazy(() => import("./pages/AICoach.tsx"));
const AICoachChat = lazy(() => import("./pages/AICoachChat.tsx"));
const AppTestMistakes = lazy(() => import("./pages/AppTestMistakes.tsx"));
const Accountability = lazy(() => import("./pages/Accountability.tsx"));
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
          <IntroSplash />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={withLayout(<Dashboard />)} />
            <Route path="/my-dashboard" element={withLayout(<StudentDashboard />)} />
            <Route path="/subjects" element={withLayout(<Subjects />)} />
            <Route path="/subjects/:id" element={withLayout(<SubjectDetail />)} />
            <Route path="/subjects/:id/chapter/:chapterId" element={withLayout(<ChapterHub />)} />
            <Route path="/subjects/:id/chapter/:chapterId/tests" element={withLayout(<ChapterTests />)} />
            <Route path="/subjects/:id/chapter/:chapterId/pdfs" element={withLayout(<ChapterPdfs />)} />
            <Route path="/tests" element={withLayout(<Tests />)} />
            <Route path="/test/:id" element={withLayout(<TestRunner />)} />
            <Route path="/analysis" element={withLayout(<TestAnalysis />)} />
            <Route path="/analysis/:attemptId" element={withLayout(<TestMistakeAnalysis />)} />
            <Route path="/smart-revision" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/smart-revision/*" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/app-test-mistakes/subject/:subjectId" element={withLayout(<AppTestMistakesSubject />)} />
            <Route path="/app-test-mistakes/subject/:subjectId/chapter/:chapterId" element={withLayout(<AppTestMistakesChapter />)} />
            <Route path="/app-test-mistakes/subject/:subjectId/chapter/:chapterId/test/:testId" element={withLayout(<AppTestMistakesTest />)} />
            <Route path="/wrong-questions" element={withLayout(<WrongQuestions />)} />
            <Route path="/bookmarks" element={withLayout(<Bookmarks />)} />
            <Route path="/revision" element={withLayout(<Revision />)} />
            <Route path="/revision-dashboard" element={withLayout(<RevisionDashboard />)} />
            <Route path="/revise" element={withLayout(<RevisionRunner />)} />
            <Route path="/revise/:testId" element={withLayout(<RevisionRunner />)} />
            <Route path="/mock-revision-hub" element={withLayout(<MockRevisionHub />)} />
            <Route path="/mock-mistakes" element={withLayout(<MockMistakes />)} />
            <Route path="/mock-mistakes/intelligence" element={withLayout(<MockMistakesIntelligence />)} />
            <Route path="/mock-mistakes/action-plan" element={withLayout(<MockMistakesActionPlan />)} />
            <Route path="/mock-mistakes/action-plan/:actionKey" element={withLayout(<MockMistakesActionPractice />)} />
            <Route path="/mock-mistakes/:subject" element={withLayout(<MockMistakesSubject />)} />
            <Route path="/mock-mistakes/:subject/:mockId" element={withLayout(<MockMistakesMock />)} />
            <Route path="/mock-mistakes/:subject/:mockId/test" element={withLayout(<MockMistakesTest />)} />
            <Route path="/mock-mistakes/:subject/topic/:topicKey" element={withLayout(<MockMistakesTopicTest />)} />

            <Route path="/mock-auto-test/:reportId" element={withLayout(<MockAutoTest />)} />
            <Route path="/about" element={withLayout(<About />)} />
            <Route path="/profile" element={withLayout(<Profile />)} />
            <Route path="/ai-mock-analyzer" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/analysis-import" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/ai-performance-center" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/app-test-mistakes" element={withLayout(<AppTestMistakes />)} />
            <Route path="/selection-intelligence" element={<Navigate to="/app-test-mistakes" replace />} />
            <Route path="/accountability" element={withLayout(<Accountability />)} />
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
            <Route
              path="/admin/tests"
              element={<AdminRoute><AppLayout><Suspense fallback={<RouteFallback />}><AdminTestManager /></Suspense></AppLayout></AdminRoute>}
            />
            <Route
              path="/admin/tests/:testId"
              element={<AdminRoute><AppLayout><Suspense fallback={<RouteFallback />}><AdminTestManager /></Suspense></AppLayout></AdminRoute>}
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SaveGateProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
