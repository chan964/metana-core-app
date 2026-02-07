import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type UserRole = "student" | "instructor" | "admin";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const roleDashboardMap: Record<UserRole, string> = {
  student: "/student",
  instructor: "/instructor",
  admin: "/admin",
};

export function ProtectedRoute({
  children,
  allowedRoles,
}: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const redirectPath = roleDashboardMap[user.role];
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}




// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '@/hooks/useAuth';
// import { UserRole } from '@/types';

// interface ProtectedRouteProps {
//   children: React.ReactNode;
//   allowedRoles?: UserRole[];
// }

// export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
//   const { isAuthenticated, isLoading, user } = useAuth();
//   const location = useLocation();

//   if (isLoading) {
//     return (
//       <div className="flex min-h-screen items-center justify-center bg-background">
//         <div className="animate-pulse text-muted-foreground">Loading...</div>
//       </div>
//     );
//   }

//   if (!isAuthenticated) {
//     return <Navigate to="/login" state={{ from: location }} replace />;
//   }

//   if (allowedRoles && user && !allowedRoles.includes(user.role)) {
//     // Redirect to appropriate dashboard based on role
//     const dashboardPath = {
//       student: '/student',
//       instructor: '/instructor',
//       admin: '/admin',
//     }[user.role];
//     return <Navigate to={dashboardPath} replace />;
//   }

//   return <>{children}</>;
// }
