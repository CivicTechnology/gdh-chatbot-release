import type { Request, Response, NextFunction } from "express";
import { generateUUID } from "@/lib/utils.js";
import { isProduction } from "@gdh-chatbot/shared";

const ANONYMOUS_SESSION_COOKIE = "anonymous_session";
const ANONYMOUS_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface SessionRequest extends Request {
	anonymousSessionId?: string;
}

/**
 * Middleware that ensures every request has a session identifier.
 * For authenticated users, this is their user ID.
 * For anonymous users, this generates and persists a UUID in a cookie.
 */
export function sessionMiddleware(
	req: SessionRequest,
	res: Response,
	next: NextFunction,
): void {
	// Check for existing anonymous session cookie
	let sessionId = req.cookies?.[ANONYMOUS_SESSION_COOKIE];

	if (!sessionId) {
		// Generate new anonymous session ID
		sessionId = generateUUID();

		// Set the cookie
		res.cookie(ANONYMOUS_SESSION_COOKIE, sessionId, {
			httpOnly: true,
			secure: isProduction,
			sameSite: "lax",
			maxAge: ANONYMOUS_SESSION_MAX_AGE,
			path: "/",
		});
	}

	req.anonymousSessionId = sessionId;
	next();
}

/**
 * Clear the anonymous session cookie (e.g., when user logs in)
 */
export function clearAnonymousSessionCookie(res: Response): void {
	res.clearCookie(ANONYMOUS_SESSION_COOKIE, { path: "/" });
}
