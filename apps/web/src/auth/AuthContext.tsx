import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { setToken } from "../api/client";

interface AuthContextValue {
  isAuthenticated: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => Boolean(localStorage.getItem("escuela-futbol-token")),
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      signIn: (token: string) => {
        setToken(token);
        setIsAuthenticated(true);
      },
      signOut: () => {
        setToken(null);
        setIsAuthenticated(false);
      },
    }),
    [isAuthenticated],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
