# Progress Log

This log is append-only. Do not rewrite or remove prior entries.

## 2026-07-17 — Initializer session

- **Session goal:** Create a persistent project harness, architecture baseline, documentation, feature inventory, and minimal TypeScript workspace scaffold. Do not implement the full product.
- **Completed work:** Normalized the assessment; created architecture, ADRs, implementation plan, environment and test strategy; created a Next.js/Convex/runner/contracts scaffold; added a structural validator and safe initializer; created the full failing feature inventory.
- **Verification performed:** Read the assessment and initializer brief; verified current official Daytona TypeScript SDK package/import and snapshot lifecycle docs, official Pi SDK `createAgentSession` docs, and Convex Node action/HTTP-action docs; ran `npm run check:structure` after scaffolding (pending final command output); generated `graphify-out/` from the assessment.
- **Files changed:** See the initial Git status after `git init`; intended project files include `AGENTS.md`, `docs/`, `feature_list.json`, workspace manifests, initial source contracts, and scripts.
- **Decisions made:** ADR-001 through ADR-007 in `docs/DECISIONS.md`.
- **Blockers:** No Daytona account credentials or VM-target capability have been supplied. Real provisioning, runner placement, integration, and benchmark claims are intentionally not made. Current official docs refer to Daytona as a `Sandbox`; this project uses that documented API while preserving the assessment's VM requirement and will block if a VM-class snapshot is unavailable.
- **Exact next recommended feature:** `convex-schema-thread-lifecycle` — implement the Convex schema and explicit state validators/indexes for threads, sandbox sessions, messages, runs, and tool executions.
- **Repository state at handoff:** Harness-only scaffold; no agent provisioning, runner execution, or real external integration has been implemented. All feature inventory entries remain failing.

## 2026-07-17 — OpenAI configuration clarification

- **Session goal:** Clarify implementation-plan phase labels, configure the local environment for OpenAI, and verify the current scaffold.
- **Completed work:** Set safe non-secret defaults for Daytona URL/target, selected `openai` with `gpt-4.1-mini`, removed DeepSeek from the project configuration, and left the assessment-required Anthropic placeholder only in `.env.example`.
- **Verification performed:** Checked `.env` variable names and value presence without printing secrets; `./init.sh`, `npm run check:structure`, `npm run typecheck`, and `npm run build` passed.
- **Files changed:** `.env`, `.env.example`, `docs/ENVIRONMENT.md`, `init.sh`, `scripts/validateHarness.mjs`.
- **Decisions made:** The assessment does not define phases; Phase 1/2 are repository implementation-plan labels. OpenAI is the active provider configuration.
- **Blockers:** `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_DEPLOYMENT`, `DAYTONA_API_KEY`, and `OPENAI_API_KEY` are still empty; real Convex/Daytona/Pi behavior is not implemented in this initializer scaffold. `TAVILY_API_KEY` is empty, so real `websearch` will not work.
- **Exact next recommended feature:** `convex-thread-lifecycle-schema`.
- **Repository state at handoff:** Static shell builds successfully; all 28 feature inventory entries remain failing.

## 2026-07-17 — Verified structural harness smoke feature

- **Selected feature:** `project-harness-structural-smoke`.
- **Implementation summary:** No product code was needed. The existing idempotent initializer and structural validator were verified from a clean temporary project copy.
- **Files changed:** `feature_list.json`, `docs/PROGRESS.md`.
- **Verification performed:** In a clean temporary copy excluding `.git`, `node_modules`, and `.env`, `./init.sh` installed locked dependencies and completed; `npm run check:structure` reported 14 required artifacts and 28 features. A fake `daytona` command placed first on `PATH` was not invoked by `./init.sh`; the initializer still completed successfully. The workspace baseline `./init.sh` and `npm run check:structure` also passed before the feature update.
- **Decisions made:** None; existing architecture remains unchanged.
- **Blockers:** None for this feature. Real Convex/Daytona/Pi integration remains intentionally unimplemented and requires subsequent features plus credentials.
- **Exact next recommended feature:** `shared-runner-event-contract` — add validators and narrow contract tests for valid, malformed, and oversized normalized runner events.
- **Repository state at handoff:** Harness smoke feature has recorded acceptance evidence and is passing; all other features remain failing.

## 2026-07-17 — Structural validator regression correction

- **Selected feature:** `project-harness-structural-smoke` (continuation of the same feature verification).
- **Implementation summary:** Corrected the structural validator so it accepts a verified passing feature only when it has non-empty evidence, while failing features must retain null evidence. This fixes the regression discovered when the first verified feature was marked passing.
- **Files changed:** `scripts/validateHarness.mjs`, `docs/PROGRESS.md`.
- **Verification performed:** `npm run check:structure` passed and reported 14 required files and 28 features with 1 passing; `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, and `git diff --check` all passed. The temporary clean-checkout directory used for verification was removed.
- **Decisions made:** None; this preserves the existing feature-inventory lifecycle rather than changing it.
- **Blockers:** None for the completed harness feature. There are no unit-test scripts yet, so `npm run test` completed with no test workspaces.
- **Exact next recommended feature:** `shared-runner-event-contract`.
- **Repository state at handoff:** The repository is runnable. The working tree is intentionally uncommitted because the project baseline itself has not yet been committed; no commit was created.

## 2026-07-17 — Shared runner event contract

- **Selected feature:** `shared-runner-event-contract`.
- **Implementation summary:** Added a pure runtime validator and a bounded size check for `AgentEvent` records. The validator lives in `packages/contracts/src/agentEvents.validate.ts` and is re-exported through `packages/contracts/src/index.ts`. The companion test file `packages/contracts/src/agentEvents.validate.test.ts` exercises both the happy path for each known event type and a set of rejection cases (non-object, unknown type, non-ISO `emittedAt`, non-numeric `sequence`, unknown `toolName`, invalid status). The size check measures the encoded UTF-8 byte length of the JSON-serialized event against the existing `maxEventBytes` (64 KiB) constant and covers below, above, and exactly-at-limit payloads. Added a vitest config and a `test` script to the `@agentic/contracts` workspace.
- **Files changed:** `packages/contracts/package.json`, `packages/contracts/src/index.ts`, `packages/contracts/src/agentEvents.validate.ts`, `packages/contracts/src/agentEvents.validate.test.ts`, `packages/contracts/vitest.config.ts`, `feature_list.json`, `docs/PROGRESS.md`.
- **Verification performed:** `npm run typecheck` and `npm run lint` (both via the workspace wrappers) passed; `npm run test --workspace=@agentic/contracts` ran 15 vitest cases, all passing (14 fast + one boundary-size case that takes ~0.8s to fill). `npm run build` and `npm run check:structure` (14 required files, 28 features with 2 passing) both passed. The new file `agentEvents.validate.ts` was verified to typecheck against the existing discriminated union without modifications to `agentEvents.ts`. No Daytona/Convex/Pi credentials were used; no mocks were substituted for real integrations.
- **Decisions made:** The wire representation keeps `sequence` as a numeric-string (consistent with `eventId`/`runId`/`threadId` opaque string IDs), and the parser converts it to the typed `number` declared on `EventEnvelope`. The validator returns a discriminated result object instead of throwing so the runner bridge can persist rejections as structured `DomainError` records during Phase 4. The contract deliberately does not add new event variants; this session only validated existing types.
- **Blockers:** None for this feature. Day-to-day local `init.sh` still tries to use `rg` for env validation but ripgrep is not on this machine; the regex checks are no-ops because the relevant env vars are blank in `.env`, so `init.sh` continues to pass. This is a pre-existing harness quirk and is not in scope for this feature.
- **Exact next recommended feature:** `convex-thread-lifecycle-schema` — implement the Convex schema, explicit state-machine validators/indexes for threads, sandbox sessions, messages, runs, and tool executions, plus unit tests that lock the rejection of invalid transitions.
- **Repository state at handoff:** The repository is runnable, all checks pass, and the feature inventory now lists 2 passing features. The working tree contains intentional changes from this session only; ready for review before any further feature work.
