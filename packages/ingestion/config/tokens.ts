/**
 * Unified token estimation for all ingestion sources.
 *
 * This provides a consistent formula for estimating token counts
 * across PDF, web, and other document types.
 */

const WHITESPACE_REGEX = /\s+/;

/**
 * Estimates the number of tokens in a text string.
 *
 * Uses a heuristic based on word count and character count:
 * - Words are multiplied by 1.3 (average tokens per word)
 * - Characters are divided by 4 (average chars per token)
 * - Takes the maximum of both estimates
 *
 * @param text - The text to estimate tokens for
 * @returns Estimated token count (minimum 1 for non-empty text)
 */
export function estimateTokens(text: string): number {
  if (!text) {
    return 0;
  }

  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  const words = trimmed.split(WHITESPACE_REGEX).length;
  const chars = trimmed.length;

  // Use the more conservative (higher) estimate
  const rough = Math.max(words * 1.3, chars / 4);

  return Math.max(1, Math.round(rough));
}

/**
 * Estimates tokens for multiple texts and returns the total.
 */
export function estimateTotalTokens(texts: string[]): number {
  return texts.reduce((sum, text) => sum + estimateTokens(text), 0);
}
