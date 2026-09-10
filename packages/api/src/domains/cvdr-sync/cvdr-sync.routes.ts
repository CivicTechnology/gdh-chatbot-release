import { Router } from "express";
import { requireAuth, requireBeheerder } from "@/domains/auth/auth.middleware.js";
import {
	cancelSync,
	startSync,
	streamSync,
	syncStatus,
} from "./cvdr-sync.controller.js";

export const cvdrSyncRouter = Router();

cvdrSyncRouter.use(requireAuth, requireBeheerder);

cvdrSyncRouter.get("/status", syncStatus);
cvdrSyncRouter.get("/stream", streamSync);
cvdrSyncRouter.post("/start", startSync);
cvdrSyncRouter.post("/cancel", cancelSync);
