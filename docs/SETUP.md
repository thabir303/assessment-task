# Setup

Every command below is run from the repository root unless stated otherwise.

## Prerequisites

- Node.js 22.18.0+ and npm
- A [Convex](https://convex.dev) account (free tier is fine)
- A [Daytona](https://daytona.io) account + API key, with the `pi-agent-v1` snapshot buildable in
  region `us` (that's the only target this snapshot has been built in so far)
- An OpenAI API key (default provider/model is `openai` / `gpt-4o-mini`) or an Anthropic API key if
  you switch `PI_PROVIDER` to `anthropic`
- Optional: a [Tavily](https://tavily.com) API key for the `websearch` tool — see the README's "Tools"
  section for a known limitation with this specific integration

## 1. Clone and install

```sh
git clone https://github.com/thabir303/assessment-task
cd assessment-task
./init.sh
```

`./init.sh` installs locked dependencies (`npm ci`), validates non-secret config shape if a local env
file already exists, and runs the structural harness check. It never talks to Daytona and never
requires secrets.

## 2. Configure Convex and get a browser-readable URL into both places that need it

```sh
npx convex dev
```

First run prompts you to create or link a Convex project, then writes `CONVEX_DEPLOYMENT`,
`CONVEX_URL`, and `NEXT_PUBLIC_CONVEX_URL` into a new `.env.local` at the repo root. **Leave this
command running** — it's a dev-mode watcher that pushes `convex/` to your deployment on every save.

`next dev` (the frontend, run from `apps/web/`) only reads env files relative to *its own* working
directory, not the monorepo root — so `apps/web/` needs its own copy of that file. `./init.sh` creates
this as a symlink automatically the next time you run it (safe to re-run any time), or create it
yourself right now:

```sh
ln -s ../../.env.local apps/web/.env.local
```

## 3. Push secrets into the Convex deployment (never into the browser, never into git)

```sh
npx convex env set DAYTONA_API_KEY <your-daytona-api-key>
npx convex env set DAYTONA_API_URL https://app.daytona.io/api
npx convex env set DAYTONA_TARGET us
npx convex env set DAYTONA_SNAPSHOT pi-agent-v1
npx convex env set PI_PROVIDER openai
npx convex env set PI_MODEL gpt-4o-mini
npx convex env set OPENAI_API_KEY <your-openai-api-key>
npx convex env set WEB_SEARCH_PROVIDER tavily
npx convex env set TAVILY_API_KEY <your-tavily-api-key>
npx convex env set AGENT_RUNNER_PORT 8787
npx convex env set AGENT_TURN_TIMEOUT_MS 480000
```

These are read by Convex's Node actions (`provisionSandbox`, `resumeSandbox`, `consumeRunnerStream`),
which is where the actual Daytona/model/search API calls happen — never in the browser. Run
`npx convex env list` any time to confirm what's set (values aren't printed by this doc on purpose).

## 4. Build the `pi-agent-v1` Daytona snapshot (one-time, billable)

```sh
npm run build --workspace=@agentic/contracts
npm run build --workspace=@agentic/sandbox-runner
DAYTONA_API_KEY=<your-daytona-api-key> DAYTONA_TARGET=us npm run provision:snapshot
```

The `DAYTONA_TARGET=us` override is required even if you've set a different value elsewhere (e.g. a
root `.env` used only for local scripting, if you keep one) — the snapshot only exists in `us` today.
Re-run this any time `sandbox/runner/src/` or `packages/contracts/src/` change; the snapshot is
prebuilt specifically so per-thread provisioning never re-installs dependencies (see
`docs/DECISIONS.md`, ADR-005) — which means runner code changes do **not** take effect until you
rebuild it.

## 5. Run

```sh
npm run dev
```

Open `http://localhost:3000`, click **New conversation**, wait for state `ready`, send a message.

## Troubleshooting

- **"Snapshot pi-agent-v1 is not available in region eu" (or similar):** you forgot the
  `DAYTONA_TARGET=us` override on step 4's snapshot command, or a root `.env` file has a different
  `DAYTONA_TARGET` than the Convex deployment does. The Convex deployment's `DAYTONA_TARGET` (set in
  step 3) is what the running app actually uses; a root `.env` is only for ad-hoc local scripts and can
  silently disagree with it.
- **"Found multiple NEXT_PUBLIC_CONVEX_URL environment variables... cannot update automatically":** a
  harmless warning from `npx convex dev` about the root `.env.local` and the `apps/web/.env.local`
  symlink both containing the same key — it just means you'll need to update the value manually if it
  ever changes (e.g. after re-linking a Convex project), which the symlink from step 2 already keeps in
  sync automatically for normal use.
- **Composer stuck on "Waiting for the agent…":** the thread isn't `ready` yet, or a run is already
  active. Check the state badge in the chat header; if it says `error`, click **Retry**.
- **A thread you created hours ago shows `error` when you send a message:** its sandbox auto-stopped
  after 30 minutes of inactivity and was deleted after the (currently 24h) auto-delete window — click
  **Retry** to provision a fresh sandbox for that same conversation.

See the README's environment variable table for the full list of variables, what they're for, and
whether they're secret.
