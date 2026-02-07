// src/hooks/useAuth.tsx
import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@/types";


interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadUser = async () => {
    try {
      const res = await fetch("/api/me", {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        return;
      }

      const data = await res.json();
      setUser(data);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
    window.location.href = "/";
  };

  useEffect(() => {
    loadUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        refetch: loadUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}


// import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
// import { User, UserRole } from '@/types';
// //import { getCurrentUser, login as apiLogin, logout as apiLogout } from '@/api/auth';

// interface AuthContextType {
//   user: User | null;
//   isLoading: boolean;
//   isAuthenticated: boolean;
//   login: (email: string, password: string) => Promise<boolean>;
//   logout: () => Promise<void>;
//   hasRole: (role: UserRole) => boolean;
// }

// const AuthContext = createContext<AuthContextType | undefined>(undefined);

// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [user, setUser] = useState<User | null>(null);
//   const [isLoading, setIsLoading] = useState(true);

//   useEffect(() => {
//     checkAuth();
//   }, []);

//   async function checkAuth() {
//     try {
//       const response = await getCurrentUser();
//       if (response.data) {
//         setUser(response.data);
//       }
//     } catch {
//       setUser(null);
//     } finally {
//       setIsLoading(false);
//     }
//   }

//   async function login(email: string, password: string): Promise<boolean> {
//     try {
//       const response = await apiLogin(email, password);
//       if (response.data?.user) {
//         setUser(response.data.user);
//         return true;
//       }
//       return false;
//     } catch {
//       return false;
//     }
//   }

//   async function logout() {
//     try {
//       await apiLogout();
//     } finally {
//       setUser(null);
//     }
//   }

//   function hasRole(role: UserRole): boolean {
//     return user?.role === role;
//   }

//   return (
//     <AuthContext.Provider
//       value={{
//         user,
//         isLoading,
//         isAuthenticated: !!user,
//         login,
//         logout,
//         hasRole,
//       }}
//     >
//       {children}
//     </AuthContext.Provider>
//   );
// }

// export function useAuth() {
//   const context = useContext(AuthContext);
//   if (context === undefined) {
//     throw new Error('useAuth must be used within an AuthProvider');
//   }
//   return context;
// }
