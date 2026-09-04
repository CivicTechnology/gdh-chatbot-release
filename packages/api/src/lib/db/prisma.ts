/**
 * Prisma Client Singleton
 *
 * This module provides a singleton instance of the Prisma Client
 * with the PostgreSQL adapter for database operations.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@gdh-chatbot/api/prisma";

const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
	pool: pg.Pool | undefined;
};

function createPrismaClient(): PrismaClient {
	const connectionString = process.env.POSTGRES_URL;

	if (!connectionString) {
		throw new Error("POSTGRES_URL environment variable is not set");
	}

	// Create a connection pool
	const pool = new pg.Pool({
		connectionString,
		max: 10,
		idleTimeoutMillis: 30000,
		connectionTimeoutMillis: 2000,
	});

	globalForPrisma.pool = pool;

	// Create the Prisma adapter
	const adapter = new PrismaPg(pool);

	// Create and return the Prisma Client
	return new PrismaClient({
		adapter,
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});
}

// Lazy initialization - only create client when first accessed
function getPrismaClient(): PrismaClient {
	if (!globalForPrisma.prisma) {
		globalForPrisma.prisma = createPrismaClient();
	}
	return globalForPrisma.prisma;
}

// Export a proxy that lazily initializes the client
export const prisma = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		const client = getPrismaClient();
		const value = client[prop as keyof PrismaClient];
		if (typeof value === "function") {
			return value.bind(client);
		}
		return value;
	},
});

/**
 * Disconnect from the database
 * Call this when shutting down the application
 */
export async function disconnectPrisma(): Promise<void> {
	if (globalForPrisma.prisma) {
		await globalForPrisma.prisma.$disconnect();
	}
	if (globalForPrisma.pool) {
		await globalForPrisma.pool.end();
	}
}

// Re-export Prisma types for convenience
export type { PrismaClient };
export { Prisma } from "@gdh-chatbot/api/prisma";
