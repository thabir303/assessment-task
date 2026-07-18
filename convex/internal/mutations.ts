import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { assertTransition } from "../lib/lifecycle";

export const recordSandboxSession = internalMutation({
  args: {
    threadId: v.id("threads"),
    sandboxId: v.string(),
    target: v.string(),
    snapshot: v.string(),
    previewUrl: v.string(),
    previewToken: v.string(),
    runnerToken: v.string(),
    runnerPort: v.number(),
    provisioningStartedAt: v.number(),
    provisioningCompletedAt: v.number()
  },
  handler: async (ctx, args) => {
    const provisioningDurationMs = args.provisioningCompletedAt - args.provisioningStartedAt;
    const existing = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, provisioningDurationMs });
    } else {
      await ctx.db.insert("sandboxSessions", { ...args, provisioningDurationMs });
    }
  }
});

export const markThreadReady = internalMutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return;
    assertTransition(thread.state, "ready");
    await ctx.db.patch(threadId, { state: "ready", updatedAt: Date.now() });
  }
});

export const markThreadError = internalMutation({
  args: { threadId: v.id("threads"), message: v.string() },
  handler: async (ctx, { threadId, message }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return;
    await ctx.db.patch(threadId, { state: "error", lastError: message, updatedAt: Date.now() });
  }
});

export const updateSandboxConnection = internalMutation({
  args: { threadId: v.id("threads"), previewUrl: v.string(), previewToken: v.string() },
  handler: async (ctx, { threadId, previewUrl, previewToken }) => {
    const existing = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();
    if (!existing) return;
    await ctx.db.patch(existing._id, { previewUrl, previewToken });
  }
});

export const appendAssistantDelta = internalMutation({
  args: { threadId: v.id("threads"), runId: v.string(), delta: v.string() },
  handler: async (ctx, { threadId, runId, delta }) => {
    const last = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_sequence", (q) => q.eq("threadId", threadId))
      .order("desc")
      .first();

    if (last && last.runId === runId && last.author === "assistant" && last.isPartial) {
      await ctx.db.patch(last._id, { content: last.content + delta });
      return;
    }

    await ctx.db.insert("messages", {
      threadId,
      sequence: (last?.sequence ?? -1) + 1,
      author: "assistant",
      content: delta,
      isPartial: true,
      runId
    });
  }
});

export const finalizeAssistantMessage = internalMutation({
  args: { threadId: v.id("threads"), runId: v.string() },
  handler: async (ctx, { threadId, runId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread_and_sequence", (q) => q.eq("threadId", threadId))
      .collect();
    const partial = messages.find((message) => message.runId === runId && message.isPartial);
    if (partial) {
      await ctx.db.patch(partial._id, { isPartial: false });
    }
  }
});

export const startToolExecution = internalMutation({
  args: {
    threadId: v.id("threads"),
    runId: v.string(),
    toolCallId: v.string(),
    name: v.string(),
    input: v.any(),
    startedAt: v.number()
  },
  handler: async (ctx, args) => {
    const last = await ctx.db
      .query("toolExecutions")
      .withIndex("by_thread_and_sequence", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .first();

    await ctx.db.insert("toolExecutions", {
      ...args,
      status: "running",
      sequence: (last?.sequence ?? -1) + 1
    });
  }
});

const MAX_STREAMING_OUTPUT_CHARS = 16 * 1024;

export const appendToolOutputChunk = internalMutation({
  args: { toolCallId: v.string(), chunk: v.string() },
  handler: async (ctx, { toolCallId, chunk }) => {
    const existing = await ctx.db
      .query("toolExecutions")
      .withIndex("by_toolCallId", (q) => q.eq("toolCallId", toolCallId))
      .unique();
    if (!existing) return;

    const combined = (existing.streamingOutput ?? "") + chunk;
    const streamingOutput =
      combined.length > MAX_STREAMING_OUTPUT_CHARS
        ? `…${combined.slice(combined.length - MAX_STREAMING_OUTPUT_CHARS)}`
        : combined;

    await ctx.db.patch(existing._id, { streamingOutput });
  }
});

export const finishToolExecution = internalMutation({
  args: {
    toolCallId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    output: v.any(),
    error: v.optional(v.string()),
    completedAt: v.number()
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("toolExecutions")
      .withIndex("by_toolCallId", (q) => q.eq("toolCallId", args.toolCallId))
      .unique();
    if (!existing) return;

    await ctx.db.patch(existing._id, {
      status: args.status,
      output: args.output,
      error: args.error,
      completedAt: args.completedAt
    });
  }
});

export const finalizeRun = internalMutation({
  args: {
    threadId: v.id("threads"),
    runId: v.string(),
    status: v.union(
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timed_out")
    ),
    error: v.optional(v.string())
  },
  handler: async (ctx, { threadId, runId, status, error }) => {
    const run = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();
    if (run) {
      await ctx.db.patch(run._id, { status, error, completedAt: Date.now() });
    }

    const thread = await ctx.db.get(threadId);
    if (thread && thread.state === "running") {
      await ctx.db.patch(threadId, { state: "ready", updatedAt: Date.now() });
    }
  }
});
