import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var monorepoRoot = path.resolve(__dirname, "../..");
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.join(monorepoRoot, "dist"),
    sourcemap: "hidden",
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - rarely changes, highly cacheable
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // UI libraries - Radix UI components
          "vendor-ui": [
            "@radix-ui/react-icons",
            "@radix-ui/react-select",
            "@radix-ui/react-use-controllable-state",
            "@radix-ui/react-visually-hidden",
            "radix-ui",
            "lucide-react",
            "framer-motion",
          ],
          // AI SDK - AI-related packages
          "vendor-ai": [
            "ai",
            "@ai-sdk/react",
            "@ai-sdk/openai",
            "@ai-sdk/gateway",
            "@ai-sdk/provider",
            "@ai-sdk/xai",
          ],
          // Editor libraries - CodeMirror and ProseMirror
          "vendor-editor": [
            "codemirror",
            "@codemirror/lang-javascript",
            "@codemirror/lang-python",
            "@codemirror/state",
            "@codemirror/theme-one-dark",
            "@codemirror/view",
            "prosemirror-example-setup",
            "prosemirror-inputrules",
            "prosemirror-markdown",
            "prosemirror-model",
            "prosemirror-schema-basic",
            "prosemirror-schema-list",
            "prosemirror-state",
            "prosemirror-view",
          ],
          // Utilities - commonly used utility libraries
          "vendor-utils": [
            "clsx",
            "classnames",
            "class-variance-authority",
            "tailwind-merge",
            "date-fns",
            "nanoid",
            "zod",
          ],
        },
      },
    },
  },
});
