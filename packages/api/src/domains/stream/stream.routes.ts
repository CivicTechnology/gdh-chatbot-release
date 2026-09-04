import { Router } from "express";
import { optionalAuth } from "@/domains/auth/auth.middleware.js";
import { resumeStream } from "./stream.controller.js";

export const streamRouter = Router();

streamRouter.get("/:id", optionalAuth, resumeStream);
