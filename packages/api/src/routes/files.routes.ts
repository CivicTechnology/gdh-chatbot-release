import { Router } from "express";
import multer from "multer";
import { requireAuth } from "@/middleware/auth.js";
import { fileUploadRateLimiter } from "@/middleware/rate-limiter.js";
import { uploadFile } from "@/controllers/files.controller.js";

const router = Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// POST /api/files/upload - Upload image files
router.post(
  "/upload",
  requireAuth,
  fileUploadRateLimiter,
  upload.single("file"),
  uploadFile
);

export default router;
