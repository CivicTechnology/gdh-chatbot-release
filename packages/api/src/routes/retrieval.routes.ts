import { Router } from "express";
import { searchDocuments } from "@/controllers/retrieval.controller.js";
import { publicRateLimiter } from "@/middleware/rate-limiter.js";

const router = Router();

// POST /api/retrieval/v1/search - Search documents (rate-limited)
router.post("/v1/search", publicRateLimiter, searchDocuments);

export default router;
