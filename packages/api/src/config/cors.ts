import type { CorsOptions } from "cors";
import { config } from "./index.js";

export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // In development, allow all localhost origins
    if (config.isDevelopment) {
      if (!origin || origin.startsWith("http://localhost")) {
        return callback(null, true);
      }
    }

    const allowedOrigins = [
      config.frontend.url,
      "http://localhost:5173",
      "http://localhost:3000",
    ];

    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      return callback(null, true);
    }

    // Allow exact matches
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "User-Agent"],
  exposedHeaders: ["Set-Cookie"],
};
