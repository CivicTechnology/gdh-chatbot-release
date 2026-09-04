/**
 * API retry and timeout configuration
 * Used for chat completions and embedding requests
 */

// ============================================================================
// Types
// ============================================================================

export type RetrySettings = {
  /** Maximum number of retry attempts for transient errors */
  maxRetries: number;
  /** Base delay in ms for exponential backoff (doubles each retry) */
  baseDelayMs: number;
  /** Maximum timeout for API requests in ms */
  timeoutMs: number;
};

export type RetryConfig = {
  chat: RetrySettings;
  embedding: RetrySettings;
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
};

// ============================================================================
// Configuration
// ============================================================================

export const retryConfig: RetryConfig = {
  chat: {
    maxRetries: 3,
    baseDelayMs: 1000,
    timeoutMs: 120_000, // 2 minutes for streaming
  },
  embedding: {
    maxRetries: 3,
    baseDelayMs: 500,
    timeoutMs: 30_000, // 30 seconds
  },
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};
