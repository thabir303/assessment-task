"use node";

import { randomBytes } from "node:crypto";
import { Daytona, type Sandbox } from "@daytona/sdk";

let cachedClient: Daytona | undefined;

/** Reads DAYTONA_API_KEY / DAYTONA_API_URL / DAYTONA_TARGET from the Convex deployment environment. */
export function getDaytonaClient(): Daytona {
  if (!cachedClient) {
    cachedClient = new Daytona();
  }
  return cachedClient;
}

const RUNNER_SESSION_ID = "runner";

export interface ProvisionedRunner {
  sandbox: Sandbox;
  runnerToken: string;
  previewUrl: string;
  previewToken: string;
  port: number;
  snapshot: string;
}

/**
 * Starts (or restarts, after a resume) the runner process in a sandbox, without erroring if a
 * session with the same id already exists -- Daytona's in-sandbox session registry is runtime
 * state of the toolbox daemon, not guaranteed to survive a stop/start the same way disk does.
 */
export async function startRunnerProcess(sandbox: Sandbox, sessionId: string = RUNNER_SESSION_ID): Promise<void> {
  const existing = await sandbox.process.listSessions().catch(() => []);
  if (!existing.some((candidate) => candidate.sessionId === sessionId)) {
    await sandbox.process.createSession(sessionId);
  }
  await sandbox.process.executeSessionCommand(sessionId, { command: "node dist/server.js", runAsync: true });
}

/**
 * Creates a brand-new private sandbox from the configured snapshot and starts the runner in it.
 * Used both for first-time thread provisioning and as the fallback path when a thread's original
 * sandbox is gone (deleted/unreachable) and there is nothing left to resume.
 */
export async function createSandboxAndStartRunner(threadId: string): Promise<ProvisionedRunner> {
  const runnerToken = randomBytes(24).toString("hex");
  const port = Number.parseInt(process.env.AGENT_RUNNER_PORT ?? "8787", 10);
  const snapshot = process.env.DAYTONA_SNAPSHOT;
  if (!snapshot) {
    throw new Error("DAYTONA_SNAPSHOT is not configured in the Convex deployment environment");
  }
  const provider = process.env.PI_PROVIDER ?? "openai";
  const providerApiKeyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
  const providerApiKey = process.env[providerApiKeyName];

  const daytona = getDaytonaClient();
  const sandbox = await daytona.create(
    {
      snapshot,
      // Deliberately not `ephemeral: true`: Daytona forces autoDeleteInterval to 0 for ephemeral
      // sandboxes, which means "delete immediately upon stopping" -- that makes stop/resume
      // impossible by construction. autoDeleteInterval below is a bounded cost safety net instead
      // of "disabled forever", so a stopped sandbox stays resumable but doesn't bill indefinitely
      // if nobody resumes it.
      autoStopInterval: 30,
      autoDeleteInterval: 1440,
      envVars: {
        THREAD_ID: threadId,
        RUNNER_TOKEN: runnerToken,
        AGENT_RUNNER_PORT: String(port),
        PI_PROVIDER: provider,
        PI_MODEL: process.env.PI_MODEL ?? "gpt-4o-mini",
        AGENT_TURN_TIMEOUT_MS: process.env.AGENT_TURN_TIMEOUT_MS ?? "480000",
        WEB_SEARCH_PROVIDER: process.env.WEB_SEARCH_PROVIDER ?? "tavily",
        ...(providerApiKey ? { [providerApiKeyName]: providerApiKey } : {}),
        ...(process.env.TAVILY_API_KEY ? { TAVILY_API_KEY: process.env.TAVILY_API_KEY } : {})
      }
    },
    { timeout: 180 }
  );

  await startRunnerProcess(sandbox);
  const preview = await sandbox.getPreviewLink(port);
  await waitForRunnerHealth(preview.url, preview.token, runnerToken);

  return { sandbox, runnerToken, previewUrl: preview.url, previewToken: preview.token, port, snapshot };
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
