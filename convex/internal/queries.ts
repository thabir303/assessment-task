import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export const getSandboxSession = internalQuery({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return ctx.db
      .query("sandboxSessions")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();
  }
});
