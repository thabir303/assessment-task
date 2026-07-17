import type { AgentEvent } from "@agentic/contracts";

export interface RunnerConfig {
  port: number;
  threadId: string;
  runnerToken: string;
  provider: string;
  model: string;
  turnTimeoutMs: number;
}

export interface TurnRequest {
  runId: string;
  clientRequestId: string;
  text: string;
}

export type EventSink = (event: AgentEvent) => Promise<void>;
