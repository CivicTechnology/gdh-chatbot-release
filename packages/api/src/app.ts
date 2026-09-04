import path from "node:path";
import { existsSync } from "node:fs";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { config } from "@/config/index.js";
import { corsOptions } from "@/config/cors.js";
import { errorHandler } from "@/middleware/error-handler.js";
import { sessionMiddleware } from "@/middleware/session.js";
import routes from "@/routes/index.js";

export function createApp() {
  const app = express();

  // SECURITY: Trust proxy headers when behind Azure's reverse proxy.
  // Required for correct client IP detection in rate limiting.
  app.set("trust proxy", 1);

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable CSP for API
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS middleware
  app.use(cors(corsOptions));

  // Body parsing middleware
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // Cookie parsing middleware
  app.use(cookieParser());

  // Anonymous session middleware (must be after cookie parser)
  app.use(sessionMiddleware);

  // Mount API routes
  app.use("/api", routes);

  // In production (e.g. Azure App Service), serve the built frontend SPA
  // from ./public relative to the server's cwd. In dev, Vite handles this.
  const publicDir = path.resolve(process.cwd(), "public");
  const indexHtml = path.join(publicDir, "index.html");
  const serveSpa = config.isProduction && existsSync(indexHtml);

  if (serveSpa) {
    app.use(express.static(publicDir));
    // SPA fallback: any non-/api route returns index.html so client-side
    // routing works on refresh/deep-link.
    app.get(/^\/(?!api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(indexHtml);
    });
  } else {
    // Dev / API-only mode: expose a simple identifier on root.
    app.get("/", (_req, res) => {
      res.json({
        name: "GDH Chatbot API",
        version: "1.0.0",
        status: "running",
      });
    });
  }

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `Cannot ${req.method} ${req.path}`,
    });
  });

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}
