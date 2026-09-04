/**
 * Environment detection utilities
 * Consolidated from various sources across the codebase
 */

export const isProduction = process.env.NODE_ENV === "production";
export const isDevelopment = process.env.NODE_ENV === "development";

/**
 * Check if running in a test environment
 * Detects Playwright and Vitest test runners
 */
export const isTest = Boolean(
  process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.PLAYWRIGHT ||
    process.env.CI_PLAYWRIGHT ||
    process.env.VITEST,
);
