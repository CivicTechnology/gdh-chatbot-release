import {
  createContext,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Session, User } from "@/api/auth";
import * as authService from "@/services/auth.service";

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  login: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  register: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

type AuthProviderProps = {
  children: ReactNode;
};

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const initializedRef = useRef(false);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    const newSession = await authService.fetchSession();
    setSession(newSession);
    setIsLoading(false);
  }, []);

  // Initialize session on mount - check for existing session
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const initializeAuth = async () => {
      setIsLoading(true);
      const existingSession = await authService.fetchSession();
      if (existingSession) {
        setSession(existingSession);
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);

    if (result.success && result.session) {
      setSession(result.session);
      return { success: true };
    }

    return {
      success: false,
      error: result.error || "Login failed",
    };
  };

  const register = async (email: string, password: string) => {
    const result = await authService.register(email, password);

    if (result.success && result.session) {
      setSession(result.session);
      return { success: true };
    }

    return {
      success: false,
      error: result.error || "Registration failed",
    };
  };

  const logout = async () => {
    await authService.logout();
    setSession(null);
  };

  const isAuthenticated = !!session?.user;
  const isAnonymous = !session?.user;

  const value: AuthContextType = {
    session,
    user: session?.user || null,
    isLoading,
    isAuthenticated,
    isAnonymous,
    login,
    register,
    logout,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
