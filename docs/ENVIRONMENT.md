# Environment Configuration

Copy `.env.example` to a local ignored file (for example `.env.local`) and configure values in the boundary that owns them. Never add real credentials to the repository. The browser may read only `NEXT_PUBLIC_CONVEX_URL`.

| Variable | Required | Owner | Configure in | Secret | Purpose | Safe example | Validation behavior |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Required for browser + Convex integration | browser | `.env.local` and deployment browser environment | No | Public Convex deployment URL used by `ConvexProvider` | `https://kind-otter-123.convex.cloud` | Must be an HTTPS URL; UI reports configuration error when absent in an integrated build. |
| `CONVEX_DEPLOYMENT` | Required for Convex CLI workflows | Convex | local shell / Convex deployment settings | No | Selects the Convex deployment for development commands | `dev:kind-otter-123` | CLI validates its deployment format; not exposed to browser code. |
| `DAYTONA_API_KEY` | Required for real provisioning | provisioning process | Convex environment variables | Yes | Authenticates Daytona lifecycle calls | `daytona_***` | Node action fails closed before provisioning if missing. |
| `DAYTONA_API_URL` | Optional | provisioning process | Convex environment variables | No | Overrides Daytona API endpoint | `https://app.daytona.io/api` | Must be an HTTPS URL when set. |
| `DAYTONA_TARGET` | Required for real provisioning | provisioning process | Convex environment variables | No | Selects Daytona compute target | `us` | Validated as a non-empty target before `Daytona.create`. |
| `DAYTONA_SNAPSHOT` | Required for real provisioning | provisioning process | Convex environment variables | No | Names prebuilt VM-compatible runner snapshot | `pi-agent-v1` | Must be non-empty; provisioning verifies returned sandbox is derived from it and records the timing. |
| `PI_PROVIDER` | Required for real runner turns | VM runner | per-sandbox secret/environment | No | Pi model provider selector | `openai` | Runner rejects unconfigured/unsupported provider values. |
| `PI_MODEL` | Required for real runner turns | VM runner | per-sandbox secret/environment | No | Pi model identifier | `gpt-4.1-mini` | Runner rejects blank value and surfaces provider errors as a run failure. |
| `ANTHROPIC_API_KEY` | Required only when `PI_PROVIDER=anthropic` | VM runner | per-sandbox secret | Yes | Credentials for Anthropic through Pi | `sk-ant-***` | Never persisted in Convex or sent to browser; runner fails closed when selected but missing. |
| `OPENAI_API_KEY` | Required only when `PI_PROVIDER=openai` | VM runner | per-sandbox secret | Yes | Credentials for OpenAI through Pi | `sk-***` | Never persisted in Convex or sent to browser; runner fails closed when selected but missing. |
| `WEB_SEARCH_PROVIDER` | Optional; defaults to `tavily` | VM runner | per-sandbox environment | No | Chooses documented web-search adapter | `tavily` | Runner accepts only implemented adapters. |
| `TAVILY_API_KEY` | Required only for real Tavily search | VM runner | per-sandbox secret | Yes | Authenticates `websearch` requests | `tvly-***` | `websearch` returns a structured configuration error if Tavily is selected but absent; never fabricates results. |
| `AGENT_RUNNER_PORT` | Optional; defaults to `8787` | VM runner | snapshot/default runner environment | No | Private runner HTTP port | `8787` | Must be an integer from 1 to 65535. |
| `MAX_ACTIVE_THREADS` | Optional; defaults to `10` | provisioning process | Convex environment variables | No | Controls allowed active provisioned/running threads | `10` | Must be a positive integer; thread creation is rejected at the configured limit. |
| `AGENT_TURN_TIMEOUT_MS` | Optional; defaults to `480000` | Convex and VM runner | Convex environment variables and per-sandbox runner environment | No | Maximum turn duration | `480000` | Must be a positive integer below the Convex action limit; timed-out turns retain partial content. |

## Dynamic per-thread credentials

`RUNNER_TOKEN` is intentionally not in `.env.example`. Provisioning creates a random per-thread token, injects it into that sandbox only through a Daytona secret/environment mechanism, and stores a non-secret token reference or hash only where needed for rotation/audit. The browser, public Convex queries, and client-readable documents never receive it.

## Ownership checks

- Local `./init.sh` validates tooling, safe defaults, the structural harness, and the format of non-secret configuration it can read.
- It does not make Daytona API calls and does not require secrets merely to run the frontend shell.
- A real provisioning action validates required Daytona configuration immediately before creating a sandbox; a real runner validates provider/search configuration immediately before use.
