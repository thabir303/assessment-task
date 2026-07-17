import { v } from "convex/values";
import { query } from "./_generated/server";

export const list = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_thread_and_sequence", (q) => q.eq("threadId", threadId))
      .collect();
  }
});
