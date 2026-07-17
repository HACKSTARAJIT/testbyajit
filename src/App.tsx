import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import { SaveGateProvider } from "@/hooks/useSaveGate";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Subjects from "./pages/Subjects.tsx";
import SubjectDetail from "./pages/SubjectDetail.tsx";
import Tests from "./pages/Tests.tsx";
import TestRunner from "./pages/TestRunner.tsx";
import TestAnalysis from "./pages/TestAnalysis.tsx";
import WrongQuestions from "./pages/WrongQuestions.tsx";
import SmartRevision from "./pages/SmartRevision.tsx";
import SmartRevisionSubject from "./pages/SmartRevisionSubject.tsx";
import SmartRevisionChapter from "./pages/SmartRevisionChapter.tsx";
import Bookmarks from "./pages/Bookmarks.tsx";
import Revision from "./pages/Revision.tsx";
import RevisionDashboard from "./pages/RevisionDashboard.tsx";
import RevisionRunner from "./pages/RevisionRunner.tsx";
import About from "./pages/About.tsx";
import Admin from "./pages/Admin.tsx";
import AdminAnalytics from "./pages/AdminAnalytics.tsx";
import AIMockAnalyzer from "./pages/AIMockAnalyzer.tsx";
import PerformanceIntelligence from "./pages/PerformanceIntelligence.tsx";
import AICoach from "./pages/AICoach.tsx";
import AICoachChat from "./pages/AICoachChat.tsx";
import AIPerformanceCenter from "./pages/AIPerformanceCenter.tsx";


import Profile from "./pages/Profile.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const withLayout = (el: JSX.Element) => (
  <ProtectedRoute><AppLayout>{el}</AppLayout></ProtectedRoute>
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
            <Route path="/performance" element={withLayout(<PerformanceIntelligence />)} />
            <Route path="/ai-coach" element={withLayout(<AICoach />)} />
            <Route path="/ai-coach/chat" element={withLayout(<AICoachChat />)} />
            <Route path="/ai-coach/chat/:threadId" element={withLayout(<AICoachChat />)} />


            <Route path="/admin" element={<AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute>} />
            <Route path="/admin/analytics" element={<AdminRoute><AppLayout><AdminAnalytics /></AppLayout></AdminRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </SaveGateProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
