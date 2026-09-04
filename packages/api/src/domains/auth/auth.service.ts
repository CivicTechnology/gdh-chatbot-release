import { createHash } from "node:crypto";
import { compareSync } from "bcrypt-ts";
import { sessionConfig } from "@gdh-chatbot/shared";
import { generateUUID } from "@/lib/utils.js";
import * as authRepository from "./auth.repository.js";
import type { AuthUser, SignInInput, SignUpInput } from "./auth.types.js";

const SESSION_MAX_AGE = sessionConfig.maxAgeMs;

export function hashToken(token: string): string {
	return createHash("sha256").update(token).digest("hex");
}

export async function signIn({ email, password }: SignInInput): Promise<{ user: AuthUser; token: string }> {
	const user = await authRepository.findUserByEmail(email);
	if (!user || !user.password) {
		throw new Error("Invalid credentials");
	}

	const isValidPassword = compareSync(password, user.password);
	if (!isValidPassword) {
		throw new Error("Invalid credentials");
	}

	const token = await createAuthSession(user.id);

	return {
		user: { id: user.id, email: user.email, type: "regular" },
		token,
	};
}

export async function signUp({ email, password }: SignUpInput): Promise<{ user: AuthUser; token: string }> {
	if (password.length < 6) {
		throw new Error("Password must be at least 6 characters");
	}

	const existingUser = await authRepository.findUserByEmail(email);
	if (existingUser) {
		throw new Error("Email already registered");
	}

	const user = await authRepository.createUser(email, password);
	const token = await createAuthSession(user.id);

	return {
		user: { id: user.id, email: user.email, type: "regular" },
		token,
	};
}

export async function signOut(token: string): Promise<void> {
	const tokenHash = hashToken(token);
	try {
		await authRepository.deleteSession(tokenHash);
	} catch {
		// Session might already be deleted, ignore
	}
}

export async function createAuthSession(userId: string): Promise<string> {
	const token = generateUUID();
	const tokenHash = hashToken(token);
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE);

	await authRepository.createSession({
		token: tokenHash,
		userId,
		expiresAt,
	});

	return token;
}

export async function getSessionByToken(token: string) {
	const tokenHash = hashToken(token);
	const session = await authRepository.findSessionByToken(tokenHash);

	if (!session || session.expiresAt < new Date()) {
		return null;
	}

	return session;
}

export function getUserById(id: string) {
	return authRepository.findUserById(id);
}

export function migrateAnonymousChats(sessionId: string, userId: string) {
	return authRepository.migrateAnonymousChatsToUser(sessionId, userId);
}
