import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { IUser } from "../models/User";
import { getCurrentUserQuery, logoutQuery, onAuthStateChange } from "../queries/auth";

interface AuthContextType {
  user: IUser | null;
  login: (user: IUser) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from Supabase session
  useEffect(() => {
    // Check for existing session
    getCurrentUserQuery().then((userData) => {
      if (userData) {
        setUser(userData);
      }
      setLoading(false);
    });

    // Listen to auth state changes
    const { data: { subscription } } = onAuthStateChange((userData) => {
      setUser(userData);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = (userData: IUser) => {
    setUser(userData);
  };

  const logout = async () => {
    try {
      await logoutQuery();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
      // Still clear local state even if Supabase logout fails
      setUser(null);
    }
  };

  // Show loading state while checking auth
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

