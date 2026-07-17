import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { assertTransition } from "./lib/lifecycle";

export const getActive = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const runs = await ctx.db
      .query("runs")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    return runs.find((run) => run.status === "running") ?? null;
  }
});

export const start = mutation({
  args: { threadId: v.id("threads"), clientRequestId: v.string(), text: v.string() },
  handler: async (ctx, { threadId, clientRequestId, text }) => {
    const existingByClientRequestId = await ctx.db
      .query("runs")
      .withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
    if (existingByClientRequestId) {
      return { runId: existingByClientRequestId.runId };
    }

    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("thread not found");
    assertTransition(thread.state, "running");

    const activeRuns = await ctx.db
      .query("runs")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .collect();
    if (activeRuns.some((run) => run.status === "running")) {
      throw new Error("a run is already active for this thread");
    }

    const now = Date.now();
    const runId = crypto.randomUUID();

    const lastMessage = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_sequence", (q) => q.eq("threadId", threadId))
      .order("desc")
      .first();

    await ctx.db.insert("messages", {
      threadId,
      sequence: (lastMessage?.sequence ?? -1) + 1,
      author: "user",
      content: text,
      isPartial: false,
      runId
    });

    await ctx.db.insert("runs", {
      threadId,
      runId,
      clientRequestId,
      status: "running",
      startedAt: now
    });

    await ctx.db.patch(threadId, { state: "running", updatedAt: now });

    await ctx.scheduler.runAfter(0, internal.actions.consumeRunnerStream.run, { threadId, runId, text });
    return { runId };
  }
});
