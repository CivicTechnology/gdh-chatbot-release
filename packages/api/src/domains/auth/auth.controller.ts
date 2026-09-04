import type { Response } from "express";
import { sessionConfig } from "@gdh-chatbot/shared";
import { signIn, signUp, signOut, migrateAnonymousChats } from "./auth.service.js";
import { setSessionCookie, clearSessionCookie } from "./auth.middleware.js";
import type { AuthenticatedRequest } from "./auth.types.js";

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
			res.status(400).json({ message: "Email and password are required" });
			return;
		}

		const { user, token } = await signIn({ email, password });
		setSessionCookie(res, token);

		// Migrate anonymous chats to the user if they have an anonymous session
		if (req.anonymousSessionId) {
			await migrateAnonymousChats(req.anonymousSessionId, user.id);
		}

		res.json({ user });
	} catch (error) {
		if (error instanceof Error && error.message === "Invalid credentials") {
			res.status(401).json({ message: "Invalid credentials" });
			return;
		}
		console.error("Signin error:", error);
		res.status(500).json({ message: "Internal server error" });
	}
}

export async function handleSignUp(req: AuthenticatedRequest, res: Response) {
	try {
		const { email, password } = req.body;

		if (!email || !password) {
			res.status(400).json({ message: "Email and password are required" });
			return;
		}

		const { user, token } = await signUp({ email, password });
		setSessionCookie(res, token);

		// Migrate anonymous chats to the new user if they have an anonymous session
		if (req.anonymousSessionId) {
			await migrateAnonymousChats(req.anonymousSessionId, user.id);
		}

		res.json({ user });
	} catch (error) {
		if (error instanceof Error) {
			if (error.message === "Password must be at least 6 characters") {
				res.status(400).json({ message: error.message });
				return;
			}
			if (error.message === "Email already registered") {
				res.status(409).json({ message: error.message });
				return;
			}
		}
		console.error("Signup error:", error);
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
