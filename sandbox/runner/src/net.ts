const RETRYABLE_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "EAI_AGAIN", "EPIPE"]);
const DEFAULT_RETRIES = 2;
const RETRY_DELAY_MS = 400;

function describeFetchError(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    const causeCode = cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : undefined;
    const causeMessage = cause instanceof Error ? cause.message : undefined;
    const details = [causeCode, causeMessage].filter(Boolean).join(": ");
    return details.length > 0 ? `${error.message} (${details})` : error.message;
  }
  return String(error);
}

function isRetryable(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const cause = (error as { cause?: unknown }).cause;
  const code = cause && typeof cause === "object" && "code" in cause ? String((cause as { code: unknown }).code) : undefined;
  return code !== undefined && RETRYABLE_CODES.has(code);
}

/**
 * Wraps fetch() with a small retry budget for transient network errors (connection resets,
 * timeouts) and surfaces the real underlying cause instead of Node's generic "fetch failed".
 */
export async function fetchWithRetry(input: string | URL, init?: RequestInit, retries = DEFAULT_RETRIES): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt === retries || !isRetryable(error)) {
        throw new Error(`network request failed: ${describeFetchError(error)}`);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * (attempt + 1)));
    }
  }
  throw new Error(`network request failed: ${describeFetchError(lastError)}`);
}
