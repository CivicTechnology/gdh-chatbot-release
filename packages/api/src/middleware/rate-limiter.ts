import type { Request } from "express";
import rateLimit from "express-rate-limit";
import { config } from "@/config/index.js";
import type { AuthenticatedRequest } from "@/auth/index.js";
import { rateLimitsConfig } from "@gdh-chatbot/shared";

/**
 * Get client IP address from request, handling proxies correctly
 * SECURITY: Properly extracts IP from X-Forwarded-For header
 */
function getClientIp(req: Request): string {
	const forwardedFor = req.headers["x-forwarded-for"];
	if (forwardedFor) {
		// Take the first IP in the chain (original client)
		const clientIp = Array.isArray(forwardedFor)
			? forwardedFor[0]
			: forwardedFor.split(",")[0]?.trim();
		if (clientIp) return clientIp;
	}
	return req.ip || "anonymous";
}

// Centralized message limits per user type
export const messageLimits = {
  regular: {
    maxMessagesPerDay: config.isDevelopment
      ? Infinity
      : rateLimitsConfig.messagesPerDay.regular,
  },
} as const;

export const chatRateLimiter = rateLimit({
  windowMs: rateLimitsConfig.chat.windowMs,
  max: rateLimitsConfig.chat.max,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || getClientIp(req);
  },
  message: {
    code: "rate_limit:chat",
    message: "Too many requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const fileUploadRateLimiter = rateLimit({
  windowMs: rateLimitsConfig.fileUpload.windowMs,
  max: rateLimitsConfig.fileUpload.max,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => {
    const authReq = req as AuthenticatedRequest;
    return authReq.user?.id || getClientIp(req);
  },
  message: {
    code: "rate_limit:chat",
    message: "Too many file uploads, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for public endpoints (IP-based only)
export const publicRateLimiter = rateLimit({
  windowMs: rateLimitsConfig.public.windowMs,
  max: rateLimitsConfig.public.max,
  skip: () => config.isDevelopment,
  keyGenerator: (req) => getClientIp(req),
  message: {
    code: "rate_limit:api",
    message: "Too many requests from this IP, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});
