import { apiClient } from "./client";

export type User = {
  id: string;
  email: string;
  type: "regular";
  role: string;
};

export type Session = {
  user: User;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterCredentials = {
  email: string;
  password: string;
};

export type AuthMethods = { entra: boolean; local: boolean };

export const authApi = {
  async login(credentials: LoginCredentials) {
    return apiClient.post<Session>("/auth/signin", {
      email: credentials.email,
      password: credentials.password,
    });
  },

  async register(credentials: RegisterCredentials) {
    return apiClient.post<Session>("/auth/signup", {
      email: credentials.email,
      password: credentials.password,
    });
  },

  async logout() {
    return apiClient.post("/auth/signout");
  },

  async getSession() {
    return apiClient.get<Session>("/auth/session");
  },

  async getMethods() {
    return apiClient.get<AuthMethods>("/auth/methods");
  },

  async mfaVerify(mfaToken: string, code: string) {
    return apiClient.post<Session>("/auth/mfa/verify", { mfaToken, code });
  },

  async mfaEnrollStart(enrollToken: string) {
    return apiClient.post<{ qrDataUrl: string }>("/auth/mfa/enroll/start", {
      enrollToken,
    });
  },

  async mfaEnrollVerify(enrollToken: string, code: string) {
    return apiClient.post<Session & { backupCodes: string[] }>(
      "/auth/mfa/enroll/verify",
      { enrollToken, code }
    );
  },
};
