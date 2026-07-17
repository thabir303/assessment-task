import { describe, expect, it } from "vitest";
import {
  isAgentEventWithinSizeLimit,
  maxEventBytes,
  parseAgentEvent,
  type AgentEvent,
} from "./index.js";

const baseWireEnvelope = {
  eventId: "evt_1",
  threadId: "thr_1",
  runId: "run_1",
  sequence: "0",
  emittedAt: "2026-07-17T00:00:00.000Z",
} as const;

describe("parseAgentEvent", () => {
  it("accepts a text_delta event", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "text_delta",
      delta: "hello",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.type === "text_delta") {
      expect(result.event.delta).toBe("hello");
      expect(result.event.sequence).toBe(0);
    }
  });

  it("accepts a tool_started event for a known tool", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "tool_started",
      toolCallId: "call_1",
      toolName: "bash",
      input: { command: "echo hi" },
      startedAt: "2026-07-17T00:00:01.000Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.type === "tool_started") {
      expect(result.event.toolName).toBe("bash");
      expect(result.event.input).toEqual({ command: "echo hi" });
    }
  });

  it("accepts a tool_updated event", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "tool_updated",
      toolCallId: "call_1",
      outputChunk: "line one\n",
    });
    expect(result.ok).toBe(true);
  });

  it("accepts a tool_finished event with a null error", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "tool_finished",
      toolCallId: "call_1",
      status: "completed",
      output: { ok: true },
      error: null,
      completedAt: "2026-07-17T00:00:02.000Z",
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.type === "tool_finished") {
      expect(result.event.status).toBe("completed");
      expect(result.event.error).toBeNull();
    }
  });

  it("accepts a run_terminal event", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "run_terminal",
      status: "completed",
      error: null,
    });
    expect(result.ok).toBe(true);
    if (result.ok && result.event.type === "run_terminal") {
      expect(result.event.status).toBe("completed");
    }
  });

  it("rejects non-object input", () => {
    const result = parseAgentEvent("nope");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/object/);
    }
  });

  it("rejects an unknown event type", () => {
    const result = parseAgentEvent({ ...baseWireEnvelope, type: "mystery" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/type/);
    }
  });

  it("rejects an envelope with a non-ISO emittedAt", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      emittedAt: "yesterday",
      type: "run_terminal",
      status: "completed",
      error: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/emittedAt/);
    }
  });

  it("rejects an envelope with a non-numeric sequence", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      sequence: "abc",
      type: "run_terminal",
      status: "completed",
      error: null,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/sequence/);
    }
  });

  it("rejects a tool_started event with an unknown tool name", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "tool_started",
      toolCallId: "call_1",
      toolName: "rm-rf",
      input: {},
      startedAt: "2026-07-17T00:00:01.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/toolName/);
    }
  });

  it("rejects a tool_finished event with an invalid status", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "tool_finished",
      toolCallId: "call_1",
      status: "pending",
      output: {},
      error: null,
      completedAt: "2026-07-17T00:00:02.000Z",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/status/);
    }
  });

  it("rejects a run_terminal event with an unknown status", () => {
    const result = parseAgentEvent({
      ...baseWireEnvelope,
      type: "run_terminal",
      status: "ok",
      error: null,
    });
    expect(result.ok).toBe(false);
  });
});

describe("isAgentEventWithinSizeLimit", () => {
  const tinyEvent: AgentEvent = {
    eventId: "evt_1",
    threadId: "thr_1",
    runId: "run_1",
    sequence: 0,
    emittedAt: "2026-07-17T00:00:00.000Z",
    type: "text_delta",
    delta: "hi",
  };

  it("accepts an event below the size limit", () => {
    expect(isAgentEventWithinSizeLimit(tinyEvent)).toBe(true);
  });

  it("rejects an event whose serialized JSON exceeds maxEventBytes", () => {
    const oversized: AgentEvent = {
      ...tinyEvent,
      delta: "x".repeat(maxEventBytes),
    };
    expect(isAgentEventWithinSizeLimit(oversized)).toBe(false);
  });

  it("accepts an event exactly at the size limit", () => {
    const encoder = new TextEncoder();
    let payload = "x";
    while (encoder.encode(JSON.stringify({ ...tinyEvent, delta: payload })).byteLength < maxEventBytes) {
      payload += "x";
    }
    const exact: AgentEvent = { ...tinyEvent, delta: payload };
    const size = encoder.encode(JSON.stringify(exact)).byteLength;
    expect(size).toBeLessThanOrEqual(maxEventBytes);
    expect(isAgentEventWithinSizeLimit(exact)).toBe(true);
  });
});