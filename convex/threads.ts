import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";
import { assertTransition } from "./lib/lifecycle";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const threads = await ctx.db.query("threads").order("desc").collect();
    return Promise.all(
      threads.map(async (thread) => {
        const session = await ctx.db
          .query("sandboxSessions")
          .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
          .unique();
        return {
          id: thread._id,
          title: thread.title,
          state: thread.state,
          sandboxId: session?.sandboxId ?? null,
          provisioningDurationMs: session?.provisioningDurationMs ?? null
        };
      })
    );
  }
});

export const get = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) return null;

    const session = await ctx.db
      .query("sandboxSessions")
      .withIndex("by_thread", (q) => q.eq("threadId", threadId))
      .unique();

    return {
      id: thread._id,
      title: thread.title,
      state: thread.state,
      lastError: thread.lastError ?? null,
      sandboxId: session?.sandboxId ?? null,
      target: session?.target ?? null,
      snapshot: session?.snapshot ?? null,
      provisioningDurationMs: session?.provisioningDurationMs ?? null
    };
  }
});

export const create = mutation({
  args: { title: v.string(), clientRequestId: v.string() },
  handler: async (ctx, { title, clientRequestId }) => {
    const existing = await ctx.db
      .query("threads")
      .withIndex("by_clientRequestId", (q) => q.eq("clientRequestId", clientRequestId))
      .unique();
    if (existing) return { threadId: existing._id };

    const now = Date.now();
    const threadId = await ctx.db.insert("threads", {
      title,
      state: "provisioning",
      clientRequestId,
      createdAt: now,
      updatedAt: now
    });

    await ctx.scheduler.runAfter(0, internal.actions.provisionSandbox.run, { threadId });
    return { threadId };
  }
});

/** Deliberately stops the thread's mapped Daytona sandbox. Only valid from `ready`. */
export const stop = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("thread not found");
    assertTransition(thread.state, "stopped");

    await ctx.db.patch(threadId, { state: "stopped", updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.actions.stopSandbox.run, { threadId });
  }
});

/**
 * Resumes a `stopped` thread (restarts the runner in the same sandbox, preserving its filesystem
 * and Pi session) or retries a `error` thread (reconnects if the sandbox is still reachable,
 * otherwise falls back to provisioning a fresh one). Both source states share one Convex
 * transition -- `provisioning` -- because from the browser's point of view both are "the
 * connection to the VM is being (re)established."
 */
export const resume = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    const thread = await ctx.db.get(threadId);
    if (!thread) throw new Error("thread not found");
    assertTransition(thread.state, "provisioning");

    await ctx.db.patch(threadId, { state: "provisioning", lastError: undefined, updatedAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.actions.resumeSandbox.run, { threadId });
  }
});
