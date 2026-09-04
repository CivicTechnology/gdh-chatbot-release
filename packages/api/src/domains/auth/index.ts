export { authRouter } from "./auth.routes.js";

// Controller exports
export { getSession, handleSignIn, handleSignUp, handleSignOut } from "./auth.controller.js";

// Service exports
export {
	hashToken,
	signIn,
	signUp,
	signOut,
	createAuthSession,
	getSessionByToken,
	getUserById,
	migrateAnonymousChats,
} from "./auth.service.js";

// Repository exports
export {
	findUserByEmail,
	findUserById,
	createUser,
	findSessionByToken,
	createSession,
	deleteSession,
	migrateAnonymousChatsToUser,
} from "./auth.repository.js";

// Middleware exports
export {
	requireAuth,
	optionalAuth,
	setSessionCookie,
	clearSessionCookie,
} from "./auth.middleware.js";

// Type exports
export type {
	AuthenticatedRequest,
	AuthUser,
	AuthSession,
	SignInInput,
	SignUpInput,
} from "./auth.types.js";
