import { createApp } from "@/app.js";
import { config } from "@/config/index.js";

const app = createApp();

const server = app.listen(config.port, "0.0.0.0", () => {
  console.log(`
🚀 GDH Chatbot API Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment:  ${config.isDevelopment ? "Development" : "Production"}
Server:       http://localhost:${config.port}
Health:       http://localhost:${config.port}/api/health
Frontend:     ${config.frontend.url}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
