/**
 * Auth Service
 * Business logic for authentication
 */

import { authApi, type Session } from "@/api/auth";

export type AuthResult = {
  success: boolean;
  session?: Session;
  error?: string;
};

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const response = await authApi.login({ email, password });

  if (response.data) {
    return { success: true, session: response.data };
  }

  return {
    success: false,
    error: response.error || "Login failed",
  };
}

export async function register(
  email: string,
  password: string
): Promise<AuthResult> {
  const response = await authApi.register({ email, password });

  if (response.data) {
    return { success: true, session: response.data };
  }

  return {
    success: false,
    error: response.error || "Registration failed",
  };
}

export async function logout(): Promise<void> {
  await authApi.logout();
}

export async function fetchSession(): Promise<Session | null> {
  const response = await authApi.getSession();
  return response.data ?? null;
}
