"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { createSandboxAndStartRunner, getDaytonaClient, startRunnerProcess, waitForRunnerHealth } from "../lib/daytona";

/**
 * Reconnects a `stopped` or `error` thread. If the thread's original sandbox is still there
 * (deliberately stopped, or merely unreachable for a moment), this restarts the runner in that
 * same sandbox -- its filesystem and Pi session survive because it was never deleted. If the
 * sandbox is truly gone (the common cause of a transport-failure `error`), this falls back to
 * provisioning a fresh sandbox for the thread; the Convex message history is untouched either
 * way, but a fresh sandbox means a fresh Pi session -- there is nothing left on disk to resume.
 */
export const run = internalAction({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const session = await ctx.runQuery(internal.internal.queries.getSandboxSession, { threadId });
    if (!session) {
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: "no sandbox session recorded for this thread"
      });
      return;
    }

    const daytona = getDaytonaClient();
    const existingSandbox = await daytona
      .get(session.sandboxId)
      .then((sandbox) => (sandbox.state === "stopped" || sandbox.state === "started" ? sandbox : null))
      .catch(() => null);

    try {
      if (existingSandbox) {
        if (existingSandbox.state === "stopped") {
          await existingSandbox.start(120);
        }
        await startRunnerProcess(existingSandbox);
        // Never trust the pre-stop preview link/token -- Daytona does not guarantee they survive
        // a stop/start, so this always re-fetches a live one before health-checking it.
        const preview = await existingSandbox.getPreviewLink(session.runnerPort);
        await waitForRunnerHealth(preview.url, preview.token, session.runnerToken);
        await ctx.runMutation(internal.internal.mutations.updateSandboxConnection, {
          threadId,
          previewUrl: preview.url,
          previewToken: preview.token
        });
      } else {
        const provisioningStartedAt = Date.now();
        const provisioned = await createSandboxAndStartRunner(threadId);
        const provisioningCompletedAt = Date.now();
        await ctx.runMutation(internal.internal.mutations.recordSandboxSession, {
          threadId,
          sandboxId: provisioned.sandbox.id,
          target: provisioned.sandbox.target,
          snapshot: provisioned.snapshot,
          previewUrl: provisioned.previewUrl,
          previewToken: provisioned.previewToken,
          runnerToken: provisioned.runnerToken,
          runnerPort: provisioned.port,
          provisioningStartedAt,
          provisioningCompletedAt
        });
      }

      await ctx.runMutation(internal.internal.mutations.markThreadReady, { threadId });
    } catch (error) {
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: `failed to resume sandbox: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
});
