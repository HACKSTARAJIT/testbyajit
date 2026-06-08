import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute, AdminRoute } from "@/components/RouteGuards";
import Index from "./pages/Index.tsx";
import Auth from "./pages/Auth.tsx";
import Dashboard from "./pages/Dashboard.tsx";
import Subjects from "./pages/Subjects.tsx";
import SubjectDetail from "./pages/SubjectDetail.tsx";
import Tests from "./pages/Tests.tsx";
import Admin from "./pages/Admin.tsx";
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
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/dashboard" element={withLayout(<Dashboard />)} />
          <Route path="/subjects" element={withLayout(<Subjects />)} />
          <Route path="/subjects/:id" element={withLayout(<SubjectDetail />)} />
          <Route path="/tests" element={withLayout(<Tests />)} />
          
          <Route path="/results" element={withLayout(<Results />)} />
          <Route path="/profile" element={withLayout(<Profile />)} />
          <Route path="/admin" element={<AdminRoute><AppLayout><Admin /></AppLayout></AdminRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
