import {
  maxEventBytes,
  toolNames,
  type AgentEvent,
  type RunTerminalStatus,
  type ToolExecutionStatus,
  type ToolName,
} from "./agentEvents.js";

export type AgentEventValidationResult =
  | { ok: true; event: AgentEvent }
  | { ok: false; reason: string };

const toolNameSet = new Set<string>(toolNames);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

function isIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]+$/.test(value);
}

function validateToolName(value: unknown): value is ToolName {
  return typeof value === "string" && toolNameSet.has(value);
}

function isToolTerminalStatus(
  value: unknown,
): value is Extract<ToolExecutionStatus, "completed" | "failed"> {
  return value === "completed" || value === "failed";
}

function isRunTerminalStatus(value: unknown): value is RunTerminalStatus {
  return (
    value === "completed" ||
    value === "failed" ||
    value === "cancelled" ||
    value === "timed_out"
  );
}

function readEnvelope(
  envelope: Record<string, unknown>,
): { ok: true; value: { eventId: string; threadId: string; runId: string; sequence: number; emittedAt: string } } | { ok: false; reason: string } {
  const { eventId: eventIdRaw, threadId: threadIdRaw, runId: runIdRaw, sequence: sequenceRaw, emittedAt: emittedAtRaw } = envelope;
  if (!isNonEmptyString(eventIdRaw)) return { ok: false, reason: "event.eventId must be a non-empty string" };
  if (!isNonEmptyString(threadIdRaw)) return { ok: false, reason: "event.threadId must be a non-empty string" };
  if (!isNonEmptyString(runIdRaw)) return { ok: false, reason: "event.runId must be a non-empty string" };
  if (!isIntegerString(sequenceRaw)) return { ok: false, reason: "event.sequence must be a non-negative integer string" };
  if (!isIsoTimestamp(emittedAtRaw)) return { ok: false, reason: "event.emittedAt must be an ISO-8601 timestamp" };
  return {
    ok: true,
    value: {
      eventId: eventIdRaw as string,
      threadId: threadIdRaw as string,
      runId: runIdRaw as string,
      sequence: Number.parseInt(sequenceRaw as string, 10),
      emittedAt: emittedAtRaw as string,
    },
  };
}

function readRequiredString(
  source: Record<string, unknown>,
  key: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const raw = source[key];
  if (!isNonEmptyString(raw)) {
    return { ok: false, reason: `${key} must be a non-empty string` };
  }
  return { ok: true, value: raw };
}

function readOptionalString(
  source: Record<string, unknown>,
  key: string,
): { ok: true; value: string | null } | { ok: false; reason: string } {
  const raw = source[key];
  if (raw === undefined || raw === null) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, reason: `${key} must be a string` };
  }
  return { ok: true, value: raw };
}

function readTimestamp(
  source: Record<string, unknown>,
  key: string,
): { ok: true; value: string } | { ok: false; reason: string } {
  const raw = source[key];
  if (!isIsoTimestamp(raw)) {
    return { ok: false, reason: `${key} must be an ISO-8601 timestamp` };
  }
  return { ok: true, value: raw as string };
}

export function parseAgentEvent(input: unknown): AgentEventValidationResult {
  if (!isRecord(input)) {
    return { ok: false, reason: "event must be an object" };
  }

  const envelopeResult = readEnvelope(input);
  if (!envelopeResult.ok) {
    return envelopeResult;
  }
  const envelope = envelopeResult.value;

  switch (input.type) {
    case "text_delta": {
      const raw = input.delta;
      if (typeof raw !== "string") {
        return { ok: false, reason: "text_delta.delta must be a string" };
      }
      const delta: string = raw;
      return {
        ok: true,
        event: {
          type: "text_delta",
          ...envelope,
          delta,
        },
      };
    }
    case "tool_started": {
      const toolCallIdResult = readRequiredString(input, "toolCallId");
      if (!toolCallIdResult.ok) return toolCallIdResult;
      const toolNameRaw = input.toolName;
      if (!validateToolName(toolNameRaw)) {
        return { ok: false, reason: "tool_started.toolName must be a known tool name" };
      }
      const toolName: ToolName = toolNameRaw;
      const inputFieldRaw = input.input;
      if (!isRecord(inputFieldRaw)) {
        return { ok: false, reason: "tool_started.input must be an object" };
      }
      const startedAtResult = readTimestamp(input, "startedAt");
      if (!startedAtResult.ok) return startedAtResult;
      return {
        ok: true,
        event: {
          type: "tool_started",
          ...envelope,
          toolCallId: toolCallIdResult.value,
          toolName,
          input: inputFieldRaw,
          startedAt: startedAtResult.value,
        },
      };
    }
    case "tool_updated": {
      const toolCallIdResult = readRequiredString(input, "toolCallId");
      if (!toolCallIdResult.ok) return toolCallIdResult;
      const outputChunkRaw = input.outputChunk;
      if (typeof outputChunkRaw !== "string") {
        return { ok: false, reason: "tool_updated.outputChunk must be a string" };
      }
      const outputChunk: string = outputChunkRaw;
      return {
        ok: true,
        event: {
          type: "tool_updated",
          ...envelope,
          toolCallId: toolCallIdResult.value,
          outputChunk,
        },
      };
    }
    case "tool_finished": {
      const toolCallIdResult = readRequiredString(input, "toolCallId");
      if (!toolCallIdResult.ok) return toolCallIdResult;
      const statusRaw = input.status;
      if (!isToolTerminalStatus(statusRaw)) {
        return { ok: false, reason: "tool_finished.status must be completed or failed" };
      }
      const status: Extract<ToolExecutionStatus, "completed" | "failed"> = statusRaw;
      const outputRaw = input.output;
      if (!isRecord(outputRaw)) {
        return { ok: false, reason: "tool_finished.output must be an object" };
      }
      const errorResult = readOptionalString(input, "error");
      if (!errorResult.ok) return errorResult;
      const completedAtResult = readTimestamp(input, "completedAt");
      if (!completedAtResult.ok) return completedAtResult;
      return {
        ok: true,
        event: {
          type: "tool_finished",
          ...envelope,
          toolCallId: toolCallIdResult.value,
          status,
          output: outputRaw,
          error: errorResult.value,
          completedAt: completedAtResult.value,
        },
      };
    }
    case "run_terminal": {
      const statusRaw = input.status;
      if (!isRunTerminalStatus(statusRaw)) {
        return { ok: false, reason: "run_terminal.status must be a known terminal status" };
      }
      const status: RunTerminalStatus = statusRaw;
      const errorResult = readOptionalString(input, "error");
      if (!errorResult.ok) return errorResult;
      return {
        ok: true,
        event: {
          type: "run_terminal",
          ...envelope,
          status,
          error: errorResult.value,
        },
      };
    }
    default:
      return { ok: false, reason: "event.type must be a known AgentEvent type" };
  }
}

export function isAgentEventWithinSizeLimit(event: AgentEvent): boolean {
  const serialized = JSON.stringify(event);
  return new TextEncoder().encode(serialized).byteLength <= maxEventBytes;
}