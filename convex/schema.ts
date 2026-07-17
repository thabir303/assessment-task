import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  threads: defineTable({
    title: v.string(),
    state: v.union(
      v.literal("provisioning"),
      v.literal("ready"),
      v.literal("running"),
      v.literal("stopped"),
      v.literal("error")
    ),
    clientRequestId: v.string(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  }).index("by_clientRequestId", ["clientRequestId"]),

  sandboxSessions: defineTable({
    threadId: v.id("threads"),
    sandboxId: v.string(),
    target: v.string(),
    snapshot: v.string(),
    previewUrl: v.string(),
    previewToken: v.string(),
    runnerToken: v.string(),
    runnerPort: v.number(),
    provisioningStartedAt: v.number(),
    provisioningCompletedAt: v.number(),
    provisioningDurationMs: v.number()
  }).index("by_thread", ["threadId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    sequence: v.number(),
    author: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isPartial: v.boolean(),
    runId: v.optional(v.string())
  }).index("by_thread_and_sequence", ["threadId", "sequence"]),

  runs: defineTable({
    threadId: v.id("threads"),
    runId: v.string(),
    clientRequestId: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("cancelled"),
      v.literal("timed_out")
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string())
  })
    .index("by_thread", ["threadId"])
    .index("by_runId", ["runId"])
    .index("by_clientRequestId", ["clientRequestId"]),

  toolExecutions: defineTable({
    threadId: v.id("threads"),
    runId: v.string(),
    toolCallId: v.string(),
    sequence: v.number(),
    name: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    input: v.any(),
    output: v.optional(v.any()),
    streamingOutput: v.optional(v.string()),
    error: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    completedAt: v.optional(v.number())
  })
    .index("by_thread_and_sequence", ["threadId", "sequence"])
    .index("by_toolCallId", ["toolCallId"])
});
