import { Router } from "express";
import { optionalAuth } from "@/domains/auth/auth.middleware.js";
import { deleteTrailingMessages } from "./message.controller.js";

export const messageRouter = Router();

messageRouter.delete("/:id/trailing", optionalAuth, deleteTrailingMessages);
