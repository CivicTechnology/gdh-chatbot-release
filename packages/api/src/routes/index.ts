import { Router } from "express";

// Domain routers
import { authRouter } from "@/domains/auth/index.js";
import { chatRouter, historyRouter } from "@/domains/chat/index.js";
import { messageRouter } from "@/domains/message/index.js";
import { voteRouter } from "@/domains/vote/index.js";

// Legacy routes (not yet migrated to domains)
import filesRoutes from "./files.routes.js";
import retrievalRoutes from "./retrieval.routes.js";
import mapRoutes from "./map.routes.js";
import tableRoutes from "./table.routes.js";

const router = Router();

// Domain routes
router.use("/auth", authRouter);
router.use("/chat", chatRouter);
router.use("/history", historyRouter);
router.use("/messages", messageRouter);
router.use("/vote", voteRouter);

// Legacy routes (files, retrieval, map, table)
router.use("/files", filesRoutes);
router.use("/retrieval", retrievalRoutes);
router.use("/map", mapRoutes);
router.use("/table", tableRoutes);

// Health check endpoint
router.get("/health", (req, res) => {
	res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

export default router;
