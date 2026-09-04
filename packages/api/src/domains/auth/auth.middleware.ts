import type { Response, NextFunction } from "express";
import { sessionConfig, isProduction } from "@gdh-chatbot/shared";
import { getSessionByToken, getUserById } from "./auth.service.js";
import type { AuthenticatedRequest } from "./auth.types.js";

const SESSION_COOKIE = sessionConfig.cookieName;
const SESSION_MAX_AGE = sessionConfig.maxAgeMs;

export function setSessionCookie(res: Response, token: string): void {
	res.cookie(SESSION_COOKIE, token, {
		httpOnly: sessionConfig.cookie.httpOnly,
		secure: isProduction,
		sameSite: sessionConfig.cookie.sameSite,
		maxAge: SESSION_MAX_AGE,
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
