import { Router } from "express";
import { getSession, handleSignIn, handleSignUp, handleSignOut } from "./auth.controller.js";
import { requireAuth } from "./auth.middleware.js";

export const authRouter = Router();

authRouter.get("/session", requireAuth, getSession);
authRouter.post("/signin", handleSignIn);
authRouter.post("/signup", handleSignUp);
authRouter.post("/signout", handleSignOut);
