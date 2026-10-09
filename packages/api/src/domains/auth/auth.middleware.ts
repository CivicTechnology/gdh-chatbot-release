import type { Response, NextFunction } from "express";
import { sessionConfig, isProduction } from "@gdh-chatbot/shared";
import { getSessionByToken, getUserById } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

const SESSION_COOKIE = sessionConfig.cookieName;
const SESSION_MAX_AGE = sessionConfig.maxAgeMs;

export function setSessionCookie(res: Response, token: string, maxAgeMs: number = SESSION_MAX_AGE): void {
	res.cookie(SESSION_COOKIE, token, {
		httpOnly: sessionConfig.cookie.httpOnly,
		secure: isProduction,
		sameSite: sessionConfig.cookie.sameSite,
		maxAge: maxAgeMs,
		path: "/",
	});
}

export function clearSessionCookie(res: Response): void {
	res.clearCookie(SESSION_COOKIE, { path: "/" });
}

/**
 * Auth middleware - requires authentication.
 * Returns 401 if no valid session.
 */
export async function requireAuth(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> {
	try {
		const token = req.cookies?.[SESSION_COOKIE];

		if (!token) {
			res.status(401).json({ error: "unauthorized", message: "No session" });
			return;
		}

		const sessionData = await getSessionByToken(token);
		if (!sessionData) {
			clearSessionCookie(res);
			res.status(401).json({ error: "unauthorized", message: "Invalid session" });
			return;
		}

		const userData = await getUserById(sessionData.userId);
		if (!userData) {
			clearSessionCookie(res);
			res.status(401).json({ error: "unauthorized", message: "User not found" });
			return;
		}

		req.user = {
			id: userData.id,
			email: userData.email,
			type: "regular",
			role: userData.role,
		};

		req.session = {
			id: sessionData.id,
			token: sessionData.token,
			expiresAt: sessionData.expiresAt,
		};

		next();
	} catch (error) {
		console.error("Auth error:", error);
		res.status(500).json({ error: "internal_error", message: "Auth failed" });
	}
}

/**
 * Beheerder-only middleware. Must run AFTER requireAuth.
 * Returns 403 when the authenticated user lacks the "beheerder" role.
 *
 * De rol staat op User.role in Postgres. Bij Entra ID SSO wordt die bij het
 * inloggen gezet op basis van de app-role-claim (zie entra.service.ts).
 */
export function requireBeheerder(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): void {
	if (!req.user) {
		res.status(401).json({ error: "unauthorized", message: "No session" });
		return;
	}
	if (req.user.role !== "beheerder") {
		res.status(403).json({ error: "forbidden", message: "Beheerder-rol vereist" });
		return;
	}
	next();
}

/**
 * Optional auth middleware - continues even without auth.
 * Populates req.user if valid session exists.
 */
export async function optionalAuth(
	req: AuthenticatedRequest,
	res: Response,
	next: NextFunction,
): Promise<void> {
	try {
		const token = req.cookies?.[SESSION_COOKIE];

		if (token) {
			const sessionData = await getSessionByToken(token);
			if (sessionData) {
				const userData = await getUserById(sessionData.userId);
				if (userData) {
					req.user = {
						id: userData.id,
						email: userData.email,
						type: "regular",
						role: userData.role,
					};
					req.session = {
						id: sessionData.id,
						token: sessionData.token,
						expiresAt: sessionData.expiresAt,
					};
				}
			}
		}

		next();
	} catch {
		// Continue without auth
		next();
	}
}
