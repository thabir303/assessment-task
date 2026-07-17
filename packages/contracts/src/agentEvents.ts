export const toolNames = ["bash", "read", "write", "edit", "grep", "glob", "webfetch", "websearch"] as const;

export type ToolName = (typeof toolNames)[number];
export type RunTerminalStatus = "completed" | "failed" | "cancelled" | "timed_out";
export type ToolExecutionStatus = "pending" | "running" | "completed" | "failed";

export interface EventEnvelope {
  eventId: string;
  threadId: string;
  runId: string;
  sequence: number;
  emittedAt: string;
}

export interface TextDeltaEvent extends EventEnvelope {
  type: "text_delta";
  delta: string;
}

export interface ToolStartedEvent extends EventEnvelope {
  type: "tool_started";
  toolCallId: string;
  toolName: ToolName;
  input: Record<string, unknown>;
  startedAt: string;
}

export interface ToolUpdatedEvent extends EventEnvelope {
  type: "tool_updated";
  toolCallId: string;
  outputChunk: string;
}

export interface ToolFinishedEvent extends EventEnvelope {
  type: "tool_finished";
  toolCallId: string;
  status: Extract<ToolExecutionStatus, "completed" | "failed">;
  output: Record<string, unknown>;
  error: string | null;
  completedAt: string;
}

export interface RunTerminalEvent extends EventEnvelope {
  type: "run_terminal";
  status: RunTerminalStatus;
  error: string | null;
}

export type AgentEvent = TextDeltaEvent | ToolStartedEvent | ToolUpdatedEvent | ToolFinishedEvent | RunTerminalEvent;

export const maxEventBytes = 64 * 1024;

