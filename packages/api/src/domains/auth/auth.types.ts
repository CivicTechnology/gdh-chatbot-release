import type { Request } from "express";
import type { SessionRequest } from "@/middleware/session.js";

export interface AuthUser {
	id: string;
	email: string;
	type: "regular";
}

export interface AuthSession {
	id: string;
	token: string;
	expiresAt: Date;
}

export interface AuthenticatedRequest extends SessionRequest {
	user?: AuthUser;
	session?: AuthSession;
}

export interface SignInInput {
	email: string;
	password: string;
}

export interface SignUpInput {
	email: string;
	password: string;
}

export interface SessionData {
	id: string;
	userId: string;
	token: string;
	expiresAt: Date;
}
