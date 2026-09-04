import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
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
  storage: {
    azure: {
      accountName: env.AZURE_STORAGE_ACCOUNT_NAME,
      accountKey: env.AZURE_STORAGE_ACCOUNT_KEY,
      connectionString: env.AZURE_STORAGE_CONNECTION_STRING,
      containerName: env.AZURE_STORAGE_CONTAINER_NAME,
    },
  },
} as const;
