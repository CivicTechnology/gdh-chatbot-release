import type { Request, Response, NextFunction } from "express";
import { ChatSDKError } from "@/lib/errors.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  // biome-ignore lint: Express requires 4 params for error handlers
  next: NextFunction
): void {
  console.error("Error:", err);

  if (err instanceof ChatSDKError) {
    const { statusCode, ...response } = err.toResponse();
    res.status(statusCode).json(response);
    return;
  }

  // Check for AI Gateway misconfiguration
  if (
    err.message?.includes(
      "AI Gateway requires a valid credit card on file to service requests"
    )
  ) {
    const error = new ChatSDKError("bad_request:activate_gateway");
    const { statusCode, ...response } = error.toResponse();
    res.status(statusCode).json(response);
    return;
  }

  // Generic error
  res.status(500).json({
    code: "offline:chat",
    message: "Something went wrong. Please try again later.",
  });
}
