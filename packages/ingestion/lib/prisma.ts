/**
 * Prisma Client for Ingestion Processors
 *
 * Creates a standalone Prisma client with connection pooling
 * to avoid overwhelming the database during batch operations.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { PrismaClient } from "@gdh-chatbot/api/prisma";

let prismaInstance: PrismaClient | undefined;
let poolInstance: pg.Pool | undefined;

function createPrismaClient(): PrismaClient {
	const connectionString = process.env.POSTGRES_URL;

	if (!connectionString) {
		throw new Error("POSTGRES_URL environment variable is not set");
	}

	const pool = new pg.Pool({
		connectionString,
		max: 5, // Reduced to avoid overwhelming Neon
		idleTimeoutMillis: 60000, // 60 seconds
		connectionTimeoutMillis: 10000, // 10 seconds to establish connection
	});

	poolInstance = pool;
	const adapter = new PrismaPg(pool);

	return new PrismaClient({
		adapter,
		log:
			process.env.NODE_ENV === "development"
				? ["query", "error", "warn"]
				: ["error"],
	});
}

function getPrisma(): PrismaClient {
	if (!prismaInstance) {
		prismaInstance = createPrismaClient();
	}
	return prismaInstance;
}

export async function disconnectPrisma(): Promise<void> {
	if (prismaInstance) {
		await prismaInstance.$disconnect();
		prismaInstance = undefined;
	}
	if (poolInstance) {
		await poolInstance.end();
		poolInstance = undefined;
	}
}

export const prisma = new Proxy({} as PrismaClient, {
	get(_target, prop) {
		const client = getPrisma();
		const value = client[prop as keyof PrismaClient];
		if (typeof value === "function") {
			return value.bind(client);
		}
		return value;
	},
});
