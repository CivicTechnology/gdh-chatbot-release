import { Router } from "express";
import rateLimit from "express-rate-limit";
import { getSession, handleSignIn, handleSignOut, getAuthMethods, handleMfaVerify, handleMfaEnrollStart, handleMfaEnrollVerify } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";
import { entraRouter } from "./entra/entra.routes.js";

// design-rate-limit: throttle auth-pogingen.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false });

export const authRouter = Router();

authRouter.get("/session", requireAuth, getSession);
authRouter.get("/methods", getAuthMethods);

authRouter.post("/signin", authLimiter, handleSignIn);
// Publieke registratie is uitgeschakeld: op het KID-platform loggen alleen
// beheerders in (via Entra SSO / lokale break-glass). Geen self-service signup.
authRouter.post("/signout", handleSignOut);

authRouter.post("/mfa/verify", authLimiter, handleMfaVerify);
authRouter.post("/mfa/enroll/start", authLimiter, handleMfaEnrollStart);
authRouter.post("/mfa/enroll/verify", authLimiter, handleMfaEnrollVerify);

authRouter.use("/entra", entraRouter);
