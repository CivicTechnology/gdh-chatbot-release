import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.string().default("3001"),
  POSTGRES_URL: z.string(),
  REDIS_URL: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  // SECURITY: AUTH_SECRET must be at least 32 characters for sufficient entropy
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AZURE_STORAGE_ACCOUNT_NAME: z.string().optional(),
  AZURE_STORAGE_ACCOUNT_KEY: z.string().optional(),
  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER_NAME: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_PROVIDER: z.string().optional(),
  AZURE_RESOURCE_NAME: z.string().optional(),
  AZURE_API_KEY: z.string().optional(),
  // Entra ID SSO (leeg = SSO uit)
  ENTRA_TENANT_ID: z.string().optional(),
  ENTRA_CLIENT_ID: z.string().optional(),
  ENTRA_CLIENT_SECRET: z.string().optional(),
  ENTRA_CLIENT_CERT_PATH: z.string().optional(),
  ENTRA_CLIENT_CERT_THUMBPRINT: z.string().optional(),
  ENTRA_REDIRECT_URI: z.string().optional(),
  ENTRA_POST_LOGOUT_REDIRECT_URI: z.string().optional(),
  ENTRA_BEHEERDER_ROLE: z.string().default("beheerder"),
  ENTRA_SESSION_MAX_AGE: z.coerce.number().int().positive().default(28800),
  LOCAL_LOGIN_ENABLED: z.enum(["true", "false"]).default("false"),
});

export const env = envSchema.parse(process.env);

export const config = {
  port: Number.parseInt(env.PORT, 10),
  isDevelopment: env.NODE_ENV === "development",
  isProduction: env.NODE_ENV === "production",
  database: {
    url: env.POSTGRES_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  auth: {
    secret: env.AUTH_SECRET,
  },
  frontend: {
    url: env.FRONTEND_URL,
  },
  entra: {
    tenantId: env.ENTRA_TENANT_ID,
    clientId: env.ENTRA_CLIENT_ID,
    clientSecret: env.ENTRA_CLIENT_SECRET,
    clientCertPath: env.ENTRA_CLIENT_CERT_PATH,
    clientCertThumbprint: env.ENTRA_CLIENT_CERT_THUMBPRINT,
    redirectUri: env.ENTRA_REDIRECT_URI,
    postLogoutRedirectUri: env.ENTRA_POST_LOGOUT_REDIRECT_URI,
    beheerderRole: env.ENTRA_BEHEERDER_ROLE,
    sessionMaxAgeMs: env.ENTRA_SESSION_MAX_AGE * 1000,
  },
  localLogin: {
    enabled: env.LOCAL_LOGIN_ENABLED === "true",
  },
  storage: {
    azure: {
      accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: env.AZURE_STORAGE_ACCOUNT_KEY,
      connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
      containerName: env.AZURE_STORAGE_CONTAINER_NAME,
    },
  },
} as const;
