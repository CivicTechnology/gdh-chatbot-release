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

export function findUserByEntraOid(entraOid: string) {
	return prisma.user.findUnique({ where: { entraOid } });
}

export function linkEntraOid(userId: string, entraOid: string, role: string) {
	return prisma.user.update({ where: { id: userId }, data: { entraOid, role } });
}

export function createEntraUser(data: { email: string; entraOid: string; role: string }) {
	return prisma.user.create({ data });
}

export function setUserRole(userId: string, role: string) {
	return prisma.user.update({ where: { id: userId }, data: { role } });
}

export function setTotpSecret(userId: string, totpSecret: string) {
	return prisma.user.update({ where: { id: userId }, data: { totpSecret } });
}

export function enableMfa(userId: string, backupCodeHashes: string[]) {
	return prisma.user.update({
		where: { id: userId },
		data: { mfaEnabled: true, mfaBackupCodes: backupCodeHashes },
	});
}

export function setBackupCodes(userId: string, hashes: string[]) {
	return prisma.user.update({ where: { id: userId }, data: { mfaBackupCodes: hashes } });
}

export function setLastTotpTimeStep(userId: string, lastTotpTimeStep: number) {
	return prisma.user.update({ where: { id: userId }, data: { lastTotpTimeStep } });
}
