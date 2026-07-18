import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { AuthStorage, createAgentSession, ModelRegistry, SessionManager } from "@mariozechner/pi-coding-agent";
import type { KnownProvider } from "@mariozechner/pi-ai";
import { toolNames, type AgentEvent, type ToolName } from "@agentic/contracts";
import { createGlobToolDefinition } from "./tools/glob.js";
import { createWebFetchToolDefinition } from "./tools/webfetch.js";
import { createWebSearchToolDefinition } from "./tools/websearch.js";
import { EventSequencer, extractText } from "./events.js";
import type { RunnerConfig, TurnRequest } from "./types.js";

function readConfig(): RunnerConfig {
  const threadId = process.env.THREAD_ID;
  const runnerToken = process.env.RUNNER_TOKEN;
  if (!threadId) throw new Error("THREAD_ID environment variable is required");
  if (!runnerToken) throw new Error("RUNNER_TOKEN environment variable is required");

  return {
    port: Number.parseInt(process.env.AGENT_RUNNER_PORT ?? "8787", 10),
    threadId,
    runnerToken,
    provider: process.env.PI_PROVIDER ?? "openai",
    model: process.env.PI_MODEL ?? "gpt-4o-mini",
    turnTimeoutMs: Number.parseInt(process.env.AGENT_TURN_TIMEOUT_MS ?? "480000", 10)
  };
}

function providerApiKeyEnvVar(provider: string): string {
  return provider === "anthropic" ? "ANTHROPIC_API_KEY" : "OPENAI_API_KEY";
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  return raw.length > 0 ? JSON.parse(raw) : {};
}

function isTurnRequest(value: unknown): value is TurnRequest {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.runId === "string" && typeof candidate.clientRequestId === "string" && typeof candidate.text === "string";
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => void): Promise<{ timedOut: boolean; result?: T }> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<{ timedOut: true }>((resolve) => {
    timer = setTimeout(() => {
      onTimeout();
      resolve({ timedOut: true });
    }, timeoutMs);
  });

  const outcome = await Promise.race([promise.then((result) => ({ timedOut: false as const, result })), timeout]);
  clearTimeout(timer);
  return outcome;
}

async function main(): Promise<void> {
  const config = readConfig();
  const cwd = process.cwd();

  const apiKeyEnvVar = providerApiKeyEnvVar(config.provider);
  const apiKey = process.env[apiKeyEnvVar];

  const authStorage = AuthStorage.create();
  if (apiKey) {
    authStorage.setRuntimeApiKey(config.provider as KnownProvider, apiKey);
  }
  const modelRegistry = ModelRegistry.create(authStorage);
  const model = modelRegistry.find(config.provider, config.model);
  if (!model) {
    throw new Error(`unknown model for provider "${config.provider}": ${config.model}`);
  }

  const { session } = await createAgentSession({
    cwd,
    model,
    authStorage,
    modelRegistry,
    // An explicit `tools` allowlist enables ONLY the named tools (including custom ones), so
    // every required tool name must be listed here or it is silently disabled.
    tools: [...toolNames],
    customTools: [
      createGlobToolDefinition(cwd),
      createWebFetchToolDefinition(),
      createWebSearchToolDefinition({
        provider: process.env.WEB_SEARCH_PROVIDER ?? "tavily",
        apiKey: process.env.TAVILY_API_KEY
      })
    ],
    // continueRecent loads the most recent session file for this cwd if one exists (surviving a
    // stop/resume of the sandbox, since the runner process itself always restarts fresh), and
    // falls back to a brand-new session when none exists yet -- SessionManager.create() would
    // always start empty even when a prior session file is sitting right there on disk.
    sessionManager: SessionManager.continueRecent(cwd)
  });

  let activeRunId: string | undefined;
  const knownToolNames = new Set<string>(toolNames);

  const server = createServer((req, res) => {
    void handleRequest(req, res);
  });

  async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${config.runnerToken}`) {
      sendJson(res, 401, { code: "runner_authentication_failed", message: "invalid or missing runner token" });
      return;
    }

    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, threadId: config.threadId, sessionId: session.sessionId, activeRunId: activeRunId ?? null });
      return;
    }

    if (req.method === "POST" && req.url === "/turn") {
      if (activeRunId) {
        sendJson(res, 409, { code: "duplicate_request", message: `run ${activeRunId} is already active for this thread` });
        return;
      }

      let body: unknown;
      try {
        body = await readJsonBody(req);
      } catch {
        sendJson(res, 400, { code: "runner_protocol_invalid", message: "request body must be JSON" });
        return;
      }
      if (!isTurnRequest(body)) {
        sendJson(res, 400, { code: "runner_protocol_invalid", message: "expected { runId, clientRequestId, text }" });
        return;
      }

      activeRunId = body.runId;
      const sequencer = new EventSequencer(config.threadId, body.runId);
      res.writeHead(200, { "content-type": "application/x-ndjson", "transfer-encoding": "chunked" });

      const write = (event: AgentEvent) => {
        // Wire format carries `sequence` as a numeric string (see agentEvents.validate.ts);
        // the typed AgentEvent keeps it numeric for in-process use.
        res.write(`${JSON.stringify({ ...event, sequence: String(event.sequence) })}\n`);
      };

      const unsubscribe = session.subscribe((event) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          write(sequencer.textDelta(event.assistantMessageEvent.delta));
          return;
        }
        if (event.type === "tool_execution_start") {
          if (!knownToolNames.has(event.toolName)) return;
          write(sequencer.toolStarted(event.toolCallId, event.toolName as ToolName, (event.args as Record<string, unknown>) ?? {}));
          return;
        }
        if (event.type === "tool_execution_update") {
          if (!knownToolNames.has(event.toolName)) return;
          write(sequencer.toolUpdated(event.toolCallId, extractText(event.partialResult)));
          return;
        }
        if (event.type === "tool_execution_end") {
          if (!knownToolNames.has(event.toolName)) return;
          const status = event.isError ? "failed" : "completed";
          write(
            sequencer.toolFinished(
              event.toolCallId,
              status,
              { content: event.result?.content ?? [], details: event.result?.details ?? null },
              event.isError ? extractText(event.result) || "tool execution failed" : null
            )
          );
        }
      });

      let terminalStatus: "completed" | "failed" | "cancelled" | "timed_out" = "completed";
      let terminalError: string | null = null;

      try {
        const outcome = await withTimeout(session.prompt(body.text), config.turnTimeoutMs, () => {
          void session.abort();
        });
        if (outcome.timedOut) {
          terminalStatus = "timed_out";
          terminalError = `turn exceeded ${config.turnTimeoutMs}ms`;
        }
      } catch (error) {
        terminalStatus = "failed";
        terminalError = error instanceof Error ? error.message : String(error);
      } finally {
        unsubscribe();
        write(sequencer.runTerminal(terminalStatus, terminalError));
        res.end();
        activeRunId = undefined;
      }
      return;
    }

    sendJson(res, 404, { code: "runner_protocol_invalid", message: "not found" });
  }

  server.listen(config.port, () => {
    process.stdout.write(`pi runner listening on :${config.port} for thread ${config.threadId}\n`);
  });
}

main().catch((error) => {
  process.stderr.write(`runner failed to start: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
