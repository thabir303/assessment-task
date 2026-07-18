# Pi in a Daytona Sandbox — Agentic Institute Systems Design Assessment

A minimal chatbot where each conversation gets its own **dedicated Daytona sandbox**, with a
[Pi coding-agent](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md)
session running **inside** that sandbox — not on the application server. [Convex](https://convex.dev)
is the control-plane backend (schema, reactive queries, and the Node actions that talk to Daytona
and to the runner).

> **Terminology note:** the assessment calls for one Daytona "VM" per conversation. Daytona's current
> public API/product surface is the `Sandbox` (an isolated, network-addressable compute unit — creation,
> `Sandbox.process`, `Sandbox.fs`, preview links, etc.). This project treats each Daytona **Sandbox** as
> the required per-thread isolated VM: it is created fresh per thread, runs a single tenant's Pi process,
> and is never shared or reused across conversations. Where "VM" appears below it refers to this sandbox.

## Architecture

![Architecture](architecture.png)

**Request flow:**
1. Browser calls `threads.create` (idempotent on `clientRequestId`) → Convex writes a `threads` row
   in state `provisioning` and schedules the `provisionSandbox` Node action.
2. `provisionSandbox` calls `daytona.create()` from the prebuilt `pi-agent-v1` snapshot, injects a
   freshly generated per-thread `RUNNER_TOKEN` plus the model/search secrets as sandbox env vars,
   starts the runner as a background session (`sandbox.process.executeSessionCommand`), polls its
   `/health` endpoint through Daytona's preview link, and on success records the sandbox id and
   provisioning duration, transitioning the thread to `ready`.
3. Browser calls `runs.start` (idempotent on `clientRequestId`, rejected unless the thread is `ready`)
   → inserts the user message, marks the thread `running`, and schedules `consumeRunnerStream`.
4. `consumeRunnerStream` POSTs the prompt to the runner's `/turn` endpoint (authenticated with the
   per-thread `RUNNER_TOKEN`, reached through Daytona's authenticated preview-link URL) and reads back
   an NDJSON stream. Each line is validated against the shared `@agentic/contracts` event schema, then
   turned into Convex writes: incremental assistant-message patches, tool-execution rows, and the
   final run/thread status.
5. The browser never talks to Daytona directly — it only holds a Convex reactive subscription, so
   streamed text and tool activity appear live as Convex mutations land.

## Key design decisions (see `docs/DECISIONS.md` for full ADRs)

| Decision | Why |
|---|---|
| Pi runs **inside** the Daytona sandbox, never on the Convex/Next.js host | The assessment requires actual agent execution inside the isolated environment, not remote tool-calls from outside it. The only `createAgentSession()` call in the repo lives in `sandbox/runner/src/server.ts`, which is baked into the Daytona snapshot image — there is no code path for running Pi on the host. |
| Browser only ever talks to Convex | Keeps Daytona credentials, the per-thread runner token, and model/search provider keys out of the browser entirely. `threads.list`/`threads.get` return a hand-picked safe projection (id/title/state/sandboxId/target/snapshot/provisioningDurationMs) — never the sandbox's `runnerToken`/`previewToken`. |
| Prebuilt `pi-agent-v1` Daytona **snapshot**, not per-thread `npm install` | Installing the runner + Pi dependencies fresh in every sandbox would dominate provisioning time. `scripts/createDaytonaSnapshot.ts` builds the image once (compiles `@agentic/contracts` and the runner to plain JS, `npm install`s `@mariozechner/pi-coding-agent` from the real registry, bakes everything into a Daytona snapshot); per-thread provisioning then only creates a sandbox from that snapshot (~2.4s observed, vs. ~6s+ for the dependency install alone). |
| NDJSON over an authenticated private HTTP endpoint, not a queue/broker | Simplest thing that satisfies "stream partial responses" without adding infrastructure. Daytona's `getPreviewLink(port)` already provides network-level access control (a `DAYTONA_SANDBOX_AUTH_KEY` token); the runner adds its own `Authorization: Bearer <RUNNER_TOKEN>` check on top, so a leaked preview URL alone isn't enough to reach `/turn`. |
| Convex stores event **projections**, not a copy of the sandbox filesystem | The sandbox is the authority for file state; copying it into Convex would be expensive and go stale immediately. Inspecting files is a Pi tool concern (`read`/`grep`/`glob`), not a Convex concern. |
| Exactly one active run per thread | A Pi `AgentSession` is a single ordered conversation; concurrent prompts would make tool/message ordering ambiguous. Enforced twice: Convex's `runs.start` mutation rejects a new run unless the thread is `ready`, and the runner itself returns HTTP 409 if a second `/turn` arrives while one is in flight. |
| Session-name resolution uses `ModelRegistry.find(provider, modelId)`, not `getModel()` | Pi's `getModel()` is generically typed against a compile-time literal model-id union; the runner's provider/model come from runtime env vars, so the dynamic `ModelRegistry.find()` lookup is the correct API for this use case. |

## Tools

All eight required tools are wired into the Pi session with their **exact** required names —
`bash`, `read`, `write`, `edit`, `grep` are Pi's built-ins; `glob`, `webfetch`, `websearch` are custom
`defineTool()` implementations in `sandbox/runner/src/tools/`:

- **glob** — real `glob` npm package. Operates anywhere in the sandbox filesystem (accepts absolute
  or cwd-relative paths), matching read/write/edit/grep's behavior — the sandbox itself, not a
  sub-path within it, is the isolation boundary (ADR-004).
- **webfetch** — http(s)-only, DNS-resolves and rejects private/loopback/link-local addresses
  (`sandbox/runner/src/security/ssrf.ts`), caps redirects (5) and response size (2 MB), retries transient
  network errors and surfaces the real cause instead of a bare `fetch failed` (`sandbox/runner/src/net.ts`).
- **websearch** — real Tavily API call; returns a structured error (never fabricated results) if
  `TAVILY_API_KEY` is missing or the provider is unsupported.

**Two bugs found and fixed** (full evidence in `feature_list.json`): (1) Pi's built-in `grep` shells out
to `ripgrep` and downloads it at runtime if missing from PATH, which failed intermittently in a fresh
sandbox — fixed by baking `ripgrep` into the `pi-agent-v1` image via `apt-get`. (2) The custom `glob`
tool originally rejected any path outside the sandbox's cwd, inconsistent with every other tool — fixed
by removing that restriction.

> **Known platform limitation (not a code defect):** this Daytona account's sandbox network resets
> HTTPS connections (`ECONNRESET`) to Cloudflare-fronted hosts specifically — confirmed across
> independent sandboxes (`example.com` and `api.tavily.com` fail, `api.github.com` succeeds; ruled out
> DNS, IPv4/IPv6, and TLS version as causes). `webfetch` works against non-Cloudflare hosts; `websearch`
> currently cannot reach Tavily from inside this account's sandboxes. Both tools retry transient errors
> and surface the real cause either way.

One non-obvious API detail worth knowing: `createAgentSession({ tools: [...] })` treats `tools` as an
**allowlist** — passing any value enables *only* those named tools, built-in or custom. An earlier
version passed a 5-name list to add `grep` to Pi's defaults, which silently disabled all three custom
tools. Fixed by always passing the full shared 8-name contract constant.

## Repository layout

```
apps/web/                  Next.js App Router chat UI (ConvexProvider, thread list, composer, tool timeline)
convex/                    Schema, public queries/mutations, internal mutations/queries, Node actions
packages/contracts/        Shared AgentEvent contract + validator + thread lifecycle state machine
sandbox/runner/             In-VM Pi runner: HTTP server, event mapping, the 3 custom tools
scripts/                   createDaytonaSnapshot.ts, benchmarkProvisioning.ts (both real, opt-in, billable)
docs/                       REQUIREMENTS / ARCHITECTURE / DECISIONS / ENVIRONMENT / TESTING / PROGRESS
feature_list.json           Per-feature acceptance criteria + honestly-recorded pass/fail evidence
```

## Setup

See [`docs/SETUP.md`](docs/SETUP.md) for the full walkthrough (prerequisites, Convex + Daytona
configuration, building the snapshot, troubleshooting). Quick version once credentials are in hand:

```sh
./init.sh                 # installs deps, validates config shape, links apps/web/.env.local
npx convex dev             # keep running; creates/links your Convex project
# push DAYTONA_*/PI_*/OPENAI_API_KEY/TAVILY_API_KEY via `npx convex env set` (see docs/SETUP.md)
DAYTONA_API_KEY=<value> DAYTONA_TARGET=us npm run provision:snapshot   # one-time, billable
npm run dev
```

Open `http://localhost:3000`, click **New conversation**, wait for state `ready`, send a message.

## Environment variables

| Variable | Where it's set | Secret | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `.env.local` (root + `apps/web/`, symlinked) | No | Convex deployment URL; only var the browser bundle reads |
| `CONVEX_DEPLOYMENT` | `.env.local` (written by `npx convex dev`) | No | Selects which deployment the Convex CLI targets |
| `DAYTONA_API_KEY` | Convex deployment env (`npx convex env set`) | **Yes** | Authenticates Daytona API calls from `provisionSandbox`/`benchmarkProvisioning` |
| `DAYTONA_API_URL` | Convex deployment env | No | Daytona API base URL (default `https://app.daytona.io/api`) |
| `DAYTONA_TARGET` | Convex deployment env | No | Daytona compute region (`us`) |
| `DAYTONA_SNAPSHOT` | Convex deployment env | No | Name of the prebuilt snapshot (`pi-agent-v1`) every thread provisions from |
| `PI_PROVIDER` | Convex deployment env → forwarded as a sandbox env var | No | `openai` or `anthropic` — selects the LLM provider Pi uses |
| `PI_MODEL` | Convex deployment env → forwarded as a sandbox env var | No | Model id passed to `ModelRegistry.find(provider, modelId)` (e.g. `gpt-4o-mini`) |
| `OPENAI_API_KEY` | Convex deployment env → forwarded as a sandbox env var | **Yes** | Required when `PI_PROVIDER=openai` |
| `ANTHROPIC_API_KEY` | Convex deployment env → forwarded as a sandbox env var | **Yes** | Required when `PI_PROVIDER=anthropic` (unused in the current default config) |
| `WEB_SEARCH_PROVIDER` | Convex deployment env → forwarded as a sandbox env var | No | Only `tavily` is implemented |
| `TAVILY_API_KEY` | Convex deployment env → forwarded as a sandbox env var | **Yes** | Required for the `websearch` tool to return real results |
| `AGENT_RUNNER_PORT` | Convex deployment env → forwarded as a sandbox env var | No | Port the in-sandbox runner HTTP server listens on (default `8787`) |
| `AGENT_TURN_TIMEOUT_MS` | Convex deployment env → forwarded as a sandbox env var | No | Max time a single turn may run before the runner aborts it (default `480000`) |
| `MAX_ACTIVE_THREADS` | Declared in `.env.example` | No | **Not yet enforced** — no code path currently checks or rejects thread creation against this limit |
| `RUNNER_TOKEN` | Generated per-thread at provisioning time, never in any `.env*` file | **Yes** | Random 24-byte token minted fresh per sandbox; authenticates the runner's `/turn`/`/health` endpoints. Stored only in Convex's `sandboxSessions` table (never returned by a public query) |

A root `.env` also exists for convenience during local scripting (e.g. `provision:snapshot`,
`benchmark:provisioning`) — see `.env.example` for its shape. The values that matter at runtime are the
ones pushed into the **Convex deployment environment**, since that's where the Node actions that talk
to Daytona actually execute.

## What's verified vs. what's left

`feature_list.json` is the source of truth — every `passes: true` entry has a dated, specific evidence
string; every `passes: false` entry has `evidence: null`. `docs/PROGRESS.md` has the full session-by-
session history, including the real bugs found and fixed along the way. Summary:

**Verified end-to-end against a real Daytona account and Convex deployment:** idempotent thread
creation and turn submission (including true concurrent races), distinct sandbox provisioning per
thread, Pi running inside the sandbox (hostname matches the recorded `sandboxId`), the NDJSON streaming
bridge, 7 of 8 required tools (`websearch` fails live — see the Cloudflare limitation above), per-thread
secret isolation, single-active-run enforcement, cross-thread filesystem isolation, real VM
**stop/resume** (same sandbox, filesystem, and Pi session across a genuine stop → resume), and **retry**
after a forced connection failure (falls back to a fresh sandbox when the original is truly gone,
keeping message history intact). The chat header exposes **Stop VM** / **Resume VM** / **Retry**
depending on thread state.

**Provisioning performance** (`npm run benchmark:provisioning`, real Daytona sandboxes, target `us`,
snapshot `pi-agent-v1`, each cleaned up automatically after measurement):

| Metric | min | median | avg | max |
|---|---|---|---|---|
| Provisioning overhead (sandbox create → runner healthy) | 3190ms | 3853ms | 3522ms | 3853ms |
| Time to first streamed event (health-check-passed → first NDJSON line) | 1408ms | 1762ms | 1585ms | 1762ms |

**Not yet done:** no automated Playwright/`test:daytona` suite — all verification above was
live/scripted against the real deployment, not mocked; the UI does not render time-to-first-token per
turn (only `provisioningDurationMs` is shown).

## Non-goals (per the assessment)

No authentication, no UI/UX polish beyond a functional minimal shell, no tools beyond the required 8,
no production hardening (rate limiting, multi-region, secret rotation, etc.).
