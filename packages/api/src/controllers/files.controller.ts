import type { Response } from "express";
import { randomUUID } from "crypto";
import { fileTypeFromBuffer } from "file-type";
import type { AuthenticatedRequest } from "@/middleware/auth.js";
import { storage } from "@/lib/storage.js";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"] as const;

export async function uploadFile(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const file = req.file;

    // Validate file size
    if (file.size > 5 * 1024 * 1024) {
      res.status(400).json({ error: "File size should be less than 5MB" });
      return;
    }

    // Detect actual file type from content
    const detectedType = await fileTypeFromBuffer(file.buffer);

    if (!detectedType || !ALLOWED_IMAGE_TYPES.includes(detectedType.mime as typeof ALLOWED_IMAGE_TYPES[number])) {
      res.status(400).json({ error: "File must be a valid JPEG or PNG image" });
      return;
    }

    // Generate safe filename using detected extension
    const safeName = `${randomUUID()}.${detectedType.ext}`;

    try {
      const data = await storage.upload(safeName, file.buffer, detectedType.mime);
      res.status(200).json(data);
    } catch (error) {
      console.error("Blob upload error:", error);
      res.status(500).json({ error: "Upload failed" });
    }
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ error: "Failed to process request" });
  }
}
