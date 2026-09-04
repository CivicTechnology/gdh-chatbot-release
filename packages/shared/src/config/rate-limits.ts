/**
 * Rate limiting configuration
 * Controls request limits for different endpoint types
 */

// ============================================================================
// Types
// ============================================================================

export type RateLimitWindow = {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum requests per window */
  max: number;
};

export type RateLimitsConfig = {
  chat: RateLimitWindow;
  fileUpload: RateLimitWindow;
  public: RateLimitWindow;
  messagesPerDay: {
    regular: number;
  };
};

// ============================================================================
// Configuration
// ============================================================================

const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;

export const rateLimitsConfig: RateLimitsConfig = {
  chat: {
    windowMs: FIFTEEN_MINUTES_MS,
    max: 100,
  },
  fileUpload: {
    windowMs: FIFTEEN_MINUTES_MS,
    max: 20,
  },
  public: {
    windowMs: FIFTEEN_MINUTES_MS,
    max: 50,
  },
  messagesPerDay: {
    regular: 200,
  },
};
