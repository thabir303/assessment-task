"use node";

import { randomBytes } from "node:crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getDaytonaClient, waitForRunnerHealth } from "../lib/daytona";

export const run = internalAction({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const provisioningStartedAt = Date.now();
    const runnerToken = randomBytes(24).toString("hex");
    const port = Number.parseInt(process.env.AGENT_RUNNER_PORT ?? "8787", 10);
    const snapshot = process.env.DAYTONA_SNAPSHOT;
    const provider = process.env.PI_PROVIDER ?? "openai";
    const providerApiKeyName = provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
    const providerApiKey = process.env[providerApiKeyName];

    try {
      if (!snapshot) {
        throw new Error("DAYTONA_SNAPSHOT is not configured in the Convex deployment environment");
      }

      const daytona = getDaytonaClient();
      const sandbox = await daytona.create(
        {
          snapshot,
          ephemeral: true,
          autoStopInterval: 30,
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

      await sandbox.process.createSession("runner");
      await sandbox.process.executeSessionCommand("runner", {
        command: "node dist/server.js",
        runAsync: true
      });

      const preview = await sandbox.getPreviewLink(port);
      await waitForRunnerHealth(preview.url, preview.token, runnerToken);

      const provisioningCompletedAt = Date.now();

      await ctx.runMutation(internal.internal.mutations.recordSandboxSession, {
        threadId,
        sandboxId: sandbox.id,
        target: sandbox.target,
        snapshot,
        previewUrl: preview.url,
        previewToken: preview.token,
        runnerToken,
        runnerPort: port,
        provisioningStartedAt,
        provisioningCompletedAt
      });

      await ctx.runMutation(internal.internal.mutations.markThreadReady, { threadId });
    } catch (error) {
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
});
