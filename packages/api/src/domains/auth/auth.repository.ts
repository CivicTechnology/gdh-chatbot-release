import { prisma } from "@/lib/db/prisma.js";
import { generateHashedPassword } from "@/lib/db/utils.js";

export function findUserByEmail(email: string) {
	return prisma.user.findUnique({ where: { email } });
}

export function findUserById(id: string) {
	return prisma.user.findUnique({ where: { id } });
}

export function createUser(email: string, password: string) {
	const hashedPassword = generateHashedPassword(password);
	return prisma.user.create({
		data: { email, password: hashedPassword },
	});
}

export function findSessionByToken(tokenHash: string) {
	return prisma.session.findUnique({ where: { token: tokenHash } });
}

export function createSession(data: { token: string; userId: string; expiresAt: Date }) {
	return prisma.session.create({ data });
}

export function deleteSession(tokenHash: string) {
	return prisma.session.delete({ where: { token: tokenHash } });
}

export function migrateAnonymousChatsToUser(sessionId: string, userId: string) {
	return prisma.chat.updateMany({
		where: { sessionId, userId: null },
		data: { userId, sessionId: null },
	});
}
