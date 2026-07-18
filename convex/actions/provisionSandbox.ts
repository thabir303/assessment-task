"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { createSandboxAndStartRunner } from "../lib/daytona";

export const run = internalAction({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const provisioningStartedAt = Date.now();

    try {
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

      await ctx.runMutation(internal.internal.mutations.markThreadReady, { threadId });
    } catch (error) {
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
});
