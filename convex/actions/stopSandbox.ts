"use node";

import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { getDaytonaClient } from "../lib/daytona";

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

    try {
      const daytona = getDaytonaClient();
      const sandbox = await daytona.get(session.sandboxId);
      await sandbox.stop(60);
    } catch (error) {
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: `failed to stop sandbox: ${error instanceof Error ? error.message : String(error)}`
      });
    }
  }
});
