/**
 * Measures real Daytona provisioning overhead end-to-end: sandbox creation, runner
 * startup, health check, and time-to-first-streamed-event for a trivial turn.
 * Addresses the assessment's "Minimal daytona overhead for speed benchmarking"
 * evaluation criterion with real, repeated measurements (not estimates).
 *
 * This is opt-in and billable (creates and deletes real sandboxes). Never invoked
 * by ./init.sh or npm run dev.
 *
 * Usage:
 *   DAYTONA_API_KEY=... DAYTONA_TARGET=us npm run benchmark:provisioning
 *   BENCHMARK_RUNS=5 npm run benchmark:provisioning   # override run count (default 3)
 */
import { randomBytes } from "node:crypto";
import { Daytona } from "@daytona/sdk";

const required = ["DAYTONA_API_KEY", "DAYTONA_TARGET", "DAYTONA_SNAPSHOT"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`benchmark:provisioning requires ${missing.join(", ")} in the process environment.`);
  process.exit(1);
}

const RUNS = Number.parseInt(process.env.BENCHMARK_RUNS ?? "3", 10);
const port = Number.parseInt(process.env.AGENT_RUNNER_PORT ?? "8787", 10);
const snapshot = process.env.DAYTONA_SNAPSHOT!;
const provider = process.env.PI_PROVIDER ?? "openai";
const providerApiKeyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
const providerApiKey = process.env[providerApiKeyName];

function previewRequestUrl(previewUrl: string, previewToken: string, path: string): string {
  const url = new URL(path, previewUrl);
  url.searchParams.set("DAYTONA_SANDBOX_AUTH_KEY", previewToken);
  return url.toString();
}

async function waitForHealthy(previewUrl: string, previewToken: string, runnerToken: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = "runner did not become healthy in time";
  while (Date.now() < deadline) {
    try {
      const response = await fetch(previewRequestUrl(previewUrl, previewToken, "/health"), {
        headers: { authorization: `Bearer ${runnerToken}` }
      });
      if (response.ok) return;
      lastError = `health check returned status ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(lastError);
}

interface RunResult {
  sandboxId: string;
  provisioningMs: number;
  timeToFirstEventMs: number;
}

async function benchmarkOnce(daytona: Daytona, index: number): Promise<RunResult> {
  const runnerToken = randomBytes(24).toString("hex");
  const threadId = `benchmark-${Date.now()}-${index}`;
  const provisioningStartedAt = Date.now();

  const sandbox = await daytona.create(
    {
      snapshot,
      ephemeral: true,
      autoStopInterval: 15,
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

  try {
    await sandbox.process.createSession("runner");
    await sandbox.process.executeSessionCommand("runner", { command: "node dist/server.js", runAsync: true });

    const preview = await sandbox.getPreviewLink(port);
    await waitForHealthy(preview.url, preview.token, runnerToken);
    const provisioningMs = Date.now() - provisioningStartedAt;

    const ttftStartedAt = Date.now();
    const response = await fetch(previewRequestUrl(preview.url, preview.token, "/turn"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${runnerToken}` },
      body: JSON.stringify({ runId: "bench", clientRequestId: "bench", text: "Reply with exactly: OK" })
    });
    if (!response.ok || !response.body) {
      throw new Error(`turn request failed: ${response.status}`);
    }
    const reader = response.body.getReader();
    await reader.read();
    const timeToFirstEventMs = Date.now() - ttftStartedAt;
    await reader.cancel();

    return { sandboxId: sandbox.id, provisioningMs, timeToFirstEventMs };
  } finally {
    await sandbox.delete(60, true).catch((error) => {
      console.error(`Warning: failed to clean up sandbox ${sandbox.id}:`, error instanceof Error ? error.message : error);
    });
  }
}

function summarize(label: string, values: number[]): void {
  const sorted = [...values].sort((a, b) => a - b);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  console.log(
    `${label}: min=${sorted[0]}ms max=${sorted[sorted.length - 1]}ms avg=${avg.toFixed(0)}ms median=${sorted[Math.floor(sorted.length / 2)]}ms (n=${values.length})`
  );
}

async function main(): Promise<void> {
  const daytona = new Daytona();
  const results: RunResult[] = [];

  for (let i = 0; i < RUNS; i += 1) {
    console.log(`Run ${i + 1}/${RUNS}...`);
    const result = await benchmarkOnce(daytona, i);
    console.log(`  sandbox=${result.sandboxId} provisioning=${result.provisioningMs}ms timeToFirstEvent=${result.timeToFirstEventMs}ms`);
    results.push(result);
  }

  console.log("\n--- Summary ---");
  summarize("Provisioning overhead", results.map((r) => r.provisioningMs));
  summarize("Time to first streamed event", results.map((r) => r.timeToFirstEventMs));
}

main().catch((error) => {
  console.error("Benchmark failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
