/**
 * Session and authentication configuration
 */

// ============================================================================
// Types
// ============================================================================

export type CookieSettings = {
  httpOnly: boolean;
  sameSite: "strict" | "lax" | "none";
};

export type SessionConfig = {
  /** Name of the session cookie */
  cookieName: string;
  /** Session duration in milliseconds */
  maxAgeMs: number;
  /** Cookie security settings */
  cookie: CookieSettings;
};

// ============================================================================
// Configuration
// ============================================================================

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const sessionConfig: SessionConfig = {
  cookieName: "session_token",
  maxAgeMs: THIRTY_DAYS_MS,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
  },
};
