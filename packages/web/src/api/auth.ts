import { apiClient } from "./client";

export type User = {
  id: string;
  email: string;
  type: "regular";
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
};
