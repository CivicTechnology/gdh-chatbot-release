import { Router } from "express";
import { optionalAuth } from "@/domains/auth/auth.middleware.js";
import { getHistory } from "./history.controller.js";

export const historyRouter = Router();

// GET /api/history - Get user's chat history with pagination
historyRouter.get("/", optionalAuth, getHistory);
