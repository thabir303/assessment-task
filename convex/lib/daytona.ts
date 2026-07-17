"use node";

import { Daytona } from "@daytona/sdk";

let cachedClient: Daytona | undefined;

/** Reads DAYTONA_API_KEY / DAYTONA_API_URL / DAYTONA_TARGET from the Convex deployment environment. */
export function getDaytonaClient(): Daytona {
  if (!cachedClient) {
    cachedClient = new Daytona();
  }
  return cachedClient;
}

export function buildPreviewRequestUrl(previewUrl: string, previewToken: string, path: string): string {
  const url = new URL(path, previewUrl);
  url.searchParams.set("DAYTONA_SANDBOX_AUTH_KEY", previewToken);
  return url.toString();
}

export async function waitForRunnerHealth(
  previewUrl: string,
  previewToken: string,
  runnerToken: string,
  timeoutMs = 60_000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "runner did not become healthy in time";

  while (Date.now() < deadline) {
    try {
      const response = await fetch(buildPreviewRequestUrl(previewUrl, previewToken, "/health"), {
        headers: { authorization: `Bearer ${runnerToken}` }
      });
      if (response.ok) return;
      lastError = `health check returned status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(lastError);
}
