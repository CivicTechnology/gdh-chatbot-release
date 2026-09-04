import { defineConfig } from "tsup";

export default defineConfig({
	entry: ["src/index.ts", "src/app.ts", "src/lib/db/prisma.ts"],
	format: ["esm"],
	clean: true,
	// Bundle the shared workspace package into the output
	// This allows using .ts exports in development while still working in production
	noExternal: ["@gdh-chatbot/shared"],
	// Exclude Prisma from bundling - it has native dependencies and uses dynamic requires
	external: [
		"@prisma/client",
		"@prisma/client-runtime-utils",
		"@prisma/adapter-pg",
		"pg",
		"@gdh-chatbot/api/prisma", // Workspace import path from other packages
		/generated\/prisma/, // Matches any path containing generated/prisma
	],
	// Add createRequire polyfill for Prisma's CommonJS require() calls in ESM context
	banner: {
		js: `import { createRequire } from 'module'; const require = createRequire(import.meta.url);`,
	},
});
