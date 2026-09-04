import { Router } from "express";
import { optionalAuth, requireAuth } from "@/domains/auth/auth.middleware.js";
import { createChat, showChat, updateVisibility, destroyChat, destroyAllChats } from "./chat.controller.js";
import { resumeStream } from "@/domains/stream/stream.controller.js";

export const chatRouter = Router();

// Chat CRUD
chatRouter.post("/", optionalAuth, createChat);
chatRouter.get("/:id", optionalAuth, showChat);
chatRouter.patch("/:id/visibility", optionalAuth, updateVisibility);
chatRouter.delete("/", requireAuth, destroyChat);
chatRouter.delete("/all", requireAuth, destroyAllChats);

// Stream resume (nested under chat)
chatRouter.get("/:id/stream", optionalAuth, resumeStream);
