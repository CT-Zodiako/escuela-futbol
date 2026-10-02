import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { refreshSnapshot, setToken } from "../api/client";
import { isDesktop } from "../api/desktop";

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
        // A failed download must not discard an existing local mirror or block login.
        if (isDesktop) void refreshSnapshot().catch(() => undefined);
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
