import { Router } from "express";
import { optionalAuth, requireAuth, requireBeheerder } from "@/domains/auth/auth.middleware.js";
import { getFeedback, index, showSharedChat, updateFeedback } from "./feedback.controller.js";

/** Publieke feedback-endpoints voor de chat-UI (ook anonieme sessies). */
export const feedbackRouter = Router();

feedbackRouter.get("/", optionalAuth, getFeedback);
feedbackRouter.patch("/", optionalAuth, updateFeedback);

/** Beheerportaal-endpoints: geldige sessie + rol "beheerder" vereist. */
export const adminFeedbackRouter = Router();

adminFeedbackRouter.use(requireAuth, requireBeheerder);

adminFeedbackRouter.get("/", index);
adminFeedbackRouter.get("/:id/chat", showSharedChat);
