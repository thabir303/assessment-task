import { randomUUID } from "node:crypto";
import type { AgentEvent, RunTerminalStatus, ToolName } from "@agentic/contracts";

const MAX_FIELD_BYTES = 32 * 1024;

export function capText(text: string): string {
  if (Buffer.byteLength(text, "utf-8") <= MAX_FIELD_BYTES) return text;
  let truncated = text;
  while (Buffer.byteLength(truncated, "utf-8") > MAX_FIELD_BYTES) {
    truncated = truncated.slice(0, Math.floor(truncated.length * 0.9));
  }
  return `${truncated}\n[truncated]`;
}

interface ContentBlock {
  type: string;
  text?: string;
}

export function extractText(value: { content?: ContentBlock[] } | undefined | null): string {
  if (!value?.content) return "";
  return value.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n");
}

export class EventSequencer {
  private sequence = 0;

  constructor(
    private readonly threadId: string,
    private readonly runId: string
  ) {}

  private envelope() {
    this.sequence += 1;
    return {
      eventId: randomUUID(),
      threadId: this.threadId,
      runId: this.runId,
      sequence: this.sequence,
      emittedAt: new Date().toISOString()
    };
  }

  textDelta(delta: string): AgentEvent {
    return { ...this.envelope(), type: "text_delta", delta: capText(delta) };
  }

  toolStarted(toolCallId: string, toolName: ToolName, input: Record<string, unknown>): AgentEvent {
    return { ...this.envelope(), type: "tool_started", toolCallId, toolName, input, startedAt: new Date().toISOString() };
  }

  toolUpdated(toolCallId: string, outputChunk: string): AgentEvent {
    return { ...this.envelope(), type: "tool_updated", toolCallId, outputChunk: capText(outputChunk) };
  }

  toolFinished(toolCallId: string, status: "completed" | "failed", output: Record<string, unknown>, error: string | null): AgentEvent {
    return {
      ...this.envelope(),
      type: "tool_finished",
      toolCallId,
      status,
      output,
      error: error ? capText(error) : null,
      completedAt: new Date().toISOString()
    };
  }

  runTerminal(status: RunTerminalStatus, error: string | null): AgentEvent {
    return { ...this.envelope(), type: "run_terminal", status, error: error ? capText(error) : null };
  }
}
