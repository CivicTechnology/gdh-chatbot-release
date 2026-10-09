import type { Response } from "express";
import { sessionConfig } from "@gdh-chatbot/shared";
import { signIn, signOut, migrateAnonymousChats, createAuthSession, getUserById } from "./auth.service.js";
import { setSessionCookie, clearSessionCookie } from "./auth.middleware.js";
import type { AuthenticatedRequest } from "./auth.types.js";
import { config } from "@/config/index.js";
import { openJson } from "@/lib/crypto/secure.js";
import { isEntraConfigured } from "./entra/entra.config.js";
import { startEnrollment, verifyEnrollment, verifySecondFactor } from "./mfa/mfa.service.js";

const SESSION_COOKIE = sessionConfig.cookieName;

export function getSession(req: AuthenticatedRequest, res: Response) {
	res.json({
		user: req.user,
		session: {
			expiresAt: req.session?.expiresAt,
		},
	});
}

export async function handleSignIn(req: AuthenticatedRequest, res: Response) {
	try {
		const { email, password } = req.body;
		if (!email || !password) {
			res.status(400).json({ message: "Inloggen mislukt" });
			return;
		}

		const result = await signIn({ email, password });

		if (result.kind === "mfa") {
			res.json({ mfaRequired: true, mfaToken: result.mfaToken });
			return;
		}
		if (result.kind === "enroll") {
			res.json({ enrollmentRequired: true, enrollToken: result.enrollToken });
			return;
		}

		setSessionCookie(res, result.token);
		if (req.anonymousSessionId) {
			await migrateAnonymousChats(req.anonymousSessionId, result.user.id);
		}
		res.json({ user: result.user });
	} catch (error) {
		// auth-generic-errors: zelfde melding voor elke fout.
		if (error instanceof Error && error.message === "Invalid credentials") {
			res.status(401).json({ message: "Inloggen mislukt" });
			return;
		}
		console.error("Signin error");
		res.status(500).json({ message: "Internal server error" });
	}
}

export async function handleSignOut(req: AuthenticatedRequest, res: Response) {
	try {
		const token = req.cookies?.[SESSION_COOKIE];
		if (token) {
			await signOut(token);
		}
		clearSessionCookie(res);
		res.json({ success: true });
	} catch (error) {
		console.error("Signout error:", error);
		clearSessionCookie(res);
		res.json({ success: true });
	}
}

export function getAuthMethods(_req: AuthenticatedRequest, res: Response) {
	res.json({ entra: isEntraConfigured(), local: config.localLogin.enabled });
}

function userIdFromToken(token: unknown, expectEnroll: boolean): string {
	if (typeof token !== "string") throw new Error("invalid");
	const data = openJson<{ userId: string; enroll?: boolean }>(token);
	if (typeof data.userId !== "string" || !data.userId) throw new Error("invalid");
	if (expectEnroll && !data.enroll) throw new Error("invalid");
	return data.userId;
}

async function toAuthUser(userId: string) {
	const u = await getUserById(userId);
	if (!u) throw new Error("invalid");
	return { id: u.id, email: u.email, type: "regular" as const, role: u.role };
}

export async function handleMfaVerify(req: AuthenticatedRequest, res: Response) {
	try {
		const userId = userIdFromToken(req.body?.mfaToken, false);
		const ok = await verifySecondFactor(userId, String(req.body?.code ?? ""));
		if (!ok) {
			res.status(401).json({ message: "Inloggen mislukt" });
			return;
		}
		const user = await toAuthUser(userId);
		const token = await createAuthSession(userId, config.entra.sessionMaxAgeMs);
		setSessionCookie(res, token, config.entra.sessionMaxAgeMs);
		res.json({ user });
	} catch {
		console.error("MFA verify error");
		res.status(401).json({ message: "Inloggen mislukt" });
	}
}

export async function handleMfaEnrollStart(req: AuthenticatedRequest, res: Response) {
	try {
		const userId = userIdFromToken(req.body?.enrollToken, true);
		const user = await getUserById(userId);
		if (!user) throw new Error("invalid");
		if (user.mfaEnabled) throw new Error("invalid");
		const { qrDataUrl } = await startEnrollment(userId, user.email);
		res.json({ qrDataUrl });
	} catch {
		console.error("MFA enroll start error");
		res.status(401).json({ message: "Inloggen mislukt" });
	}
}

export async function handleMfaEnrollVerify(req: AuthenticatedRequest, res: Response) {
	try {
		const userId = userIdFromToken(req.body?.enrollToken, true);
		const backupCodes = await verifyEnrollment(userId, String(req.body?.code ?? ""));
		const user = await toAuthUser(userId);
		const token = await createAuthSession(userId, config.entra.sessionMaxAgeMs);
		setSessionCookie(res, token, config.entra.sessionMaxAgeMs);
		res.json({ user, backupCodes });
	} catch (error) {
		if (error instanceof Error && error.message === "Ongeldige code") {
			res.status(401).json({ message: "Ongeldige code" });
			return;
		}
		console.error("MFA enroll verify error");
		res.status(401).json({ message: "Inloggen mislukt" });
	}
}
