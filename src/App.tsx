import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Layout } from "@/components/Layout";

// Pages
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import StudentDashboard from "./pages/StudentDashboard";
import StudentModuleView from "./pages/StudentModuleView";
import InstructorDashboard from "./pages/InstructorDashboard";
import InstructorSubmissions from "./pages/InstructorSubmissions";
import GradingView from "./pages/GradingView";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AuthenticatedRedirect() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <LandingPage />;
  }

  // Redirect to appropriate dashboard based on role
  const dashboardPath = {
    student: '/student',
    instructor: '/instructor',
    admin: '/admin',
  }[user.role];

  return <Navigate to={dashboardPath} replace />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<AuthenticatedRedirect />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Student routes */}
            <Route element={<Layout />}>
              <Route
                path="/student"
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <StudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/student/module/:moduleId"
                element={
                  <ProtectedRoute allowedRoles={['student']}>
                    <StudentModuleView />
                  </ProtectedRoute>
                }
              />

              {/* Instructor routes */}
              <Route
                path="/instructor"
                element={
                  <ProtectedRoute allowedRoles={['instructor']}>
                    <InstructorDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/module/:moduleId/submissions"
                element={
                  <ProtectedRoute allowedRoles={['instructor']}>
                    <InstructorSubmissions />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/instructor/submission/:submissionId"
                element={
                  <ProtectedRoute allowedRoles={['instructor']}>
                    <GradingView />
                  </ProtectedRoute>
                }
              />

              {/* Admin routes */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
