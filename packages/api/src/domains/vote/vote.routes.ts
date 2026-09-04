import { Router } from "express";
import { optionalAuth } from "@/domains/auth/auth.middleware.js";
import { getVotes, updateVote } from "./vote.controller.js";

export const voteRouter = Router();

voteRouter.get("/", optionalAuth, getVotes);
voteRouter.patch("/", optionalAuth, updateVote);
