// Re-export from the auth domain for backward compatibility
// This file is deprecated, import from @/domains/auth/index.js instead

export {
	requireAuth,
	optionalAuth,
	setSessionCookie,
	clearSessionCookie,
	hashToken,
	createAuthSession,
	getSessionByToken,
	getUserById,
	type AuthenticatedRequest,
} from "@/domains/auth/index.js";

// Alias for backward compatibility
export { createAuthSession as createSession } from "@/domains/auth/index.js";
