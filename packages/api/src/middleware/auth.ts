// Re-export from the auth domain for backward compatibility
export {
	requireAuth,
	optionalAuth,
	setSessionCookie,
	clearSessionCookie,
	type AuthenticatedRequest,
} from "@/domains/auth/index.js";
