"use node";

import { isAgentEventWithinSizeLimit, parseAgentEvent } from "@agentic/contracts";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { buildPreviewRequestUrl } from "../lib/daytona";

export const run = internalAction({
  args: { threadId: v.id("threads"), runId: v.string(), text: v.string() },
  handler: async (ctx, { threadId, runId, text }) => {
    const session = await ctx.runQuery(internal.internal.queries.getSandboxSession, { threadId });

    if (!session) {
      await ctx.runMutation(internal.internal.mutations.finalizeRun, {
        threadId,
        runId,
        status: "failed",
        error: "sandbox session not found for this thread"
      });
      return;
    }

    let terminalStatus: "completed" | "failed" | "cancelled" | "timed_out" = "failed";
    let terminalError: string | undefined = "stream ended before a run_terminal event was received";
    let transportFailed = false;

    const handleLine = async (line: string) => {
      if (line.trim().length === 0) return;
      let raw: unknown;
      try {
        raw = JSON.parse(line);
      } catch {
        return;
      }
      const parsed = parseAgentEvent(raw);
      if (!parsed.ok || !isAgentEventWithinSizeLimit(parsed.event)) return;
      const event = parsed.event;

      switch (event.type) {
        case "text_delta":
          await ctx.runMutation(internal.internal.mutations.appendAssistantDelta, {
            threadId,
            runId,
            delta: event.delta
          });
          break;
        case "tool_started":
          await ctx.runMutation(internal.internal.mutations.startToolExecution, {
            threadId,
            runId,
            toolCallId: event.toolCallId,
            name: event.toolName,
            input: event.input,
            startedAt: Date.now()
          });
          break;
        case "tool_updated":
          if (event.outputChunk.length > 0) {
            await ctx.runMutation(internal.internal.mutations.appendToolOutputChunk, {
              toolCallId: event.toolCallId,
              chunk: event.outputChunk
            });
          }
          break;
        case "tool_finished":
          await ctx.runMutation(internal.internal.mutations.finishToolExecution, {
            toolCallId: event.toolCallId,
            status: event.status,
            output: event.output,
            error: event.error ?? undefined,
            completedAt: Date.now()
          });
          break;
        case "run_terminal":
          terminalStatus = event.status;
          terminalError = event.error ?? undefined;
          break;
      }
    };

    try {
      const response = await fetch(buildPreviewRequestUrl(session.previewUrl, session.previewToken, "/turn"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.runnerToken}`
        },
        body: JSON.stringify({ runId, clientRequestId: runId, text })
      });

      if (!response.ok || !response.body) {
        throw new Error(`runner returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          await handleLine(line);
          newlineIndex = buffer.indexOf("\n");
        }
      }
      if (buffer.length > 0) {
        await handleLine(buffer);
      }
    } catch (error) {
      terminalStatus = "failed";
      terminalError = error instanceof Error ? error.message : String(error);
      transportFailed = true;
    }

    if (transportFailed) {
      // The runner itself was unreachable (e.g. the sandbox stopped/was deleted while idle),
      // not just a failed turn -- surface this as a thread-level error instead of silently
      // reverting to "ready" with a now-dead sandbox reference.
      await ctx.runMutation(internal.internal.mutations.markThreadError, {
        threadId,
        message: `Lost connection to the sandbox: ${terminalError}. Start a new conversation to get a fresh sandbox.`
      });
    }

    await ctx.runMutation(internal.internal.mutations.finalizeAssistantMessage, { threadId, runId });
    await ctx.runMutation(internal.internal.mutations.finalizeRun, {
      threadId,
      runId,
      status: terminalStatus,
      error: terminalError
    });
  }
});
