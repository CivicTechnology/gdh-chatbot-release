import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Load environment variables from root .env.local (only for local development).
// In CI/production, env vars are provided by the platform.
if (!process.env.CI) {
	config({ path: path.resolve(__dirname, "../../.env.local") });
}

// Prisma CLI (migrations, introspection) needs a direct connection, not pooled.
// Neon pooled: ep-xxx-pooler.region.aws.neon.tech
// Neon direct: ep-xxx.region.aws.neon.tech
// See: https://neon.com/docs/guides/prisma
const pooledUrl = process.env.POSTGRES_URL ?? "";
const directUrl = pooledUrl.replace("-pooler.", ".");

export default defineConfig({
	schema: "prisma/schema.prisma",
	migrations: {
		path: "prisma/migrations",
	},
	datasource: {
		url: directUrl,
	},
});
