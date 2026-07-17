# Implementation Plan

Implement one phase feature at a time. No phase is complete until its listed verification has succeeded and evidence is recorded in `feature_list.json`.

## Phase 0 — Harness and contracts

- **Inputs:** assessment, architecture, package manifest.
- **Outputs:** persistent handoff protocol, shared event types, feature inventory, environment contract, and structural smoke check.
- **Verification commands:** `./init.sh`; `npm run check:structure`.
- **Exit criteria:** all harness files exist, feature JSON is valid and all items fail initially.
- **Dependencies:** none.
- **Known risks:** external SDK APIs can drift; verify them immediately before Phase 2/3 implementation.

## Phase 1 — Convex schema and local frontend shell

- **Inputs:** event contracts and state-machine design.
- **Outputs:** Convex schema with `threads`, `sandboxSessions`, `messages`, `runs`, `toolExecutions`; indexes; minimal responsive Next.js shell and state displays.
- **Verification commands:** `npm run typecheck`; `npm run test -- --run`; `npm run dev`.
- **Exit criteria:** locally mocked thread lifecycle renders through reactive Convex data; no real Daytona call.
- **Dependencies:** Phase 0.
- **Known risks:** schema validators must prevent client access to secrets and concurrent active runs.

## Phase 2 — Daytona provisioning

- **Inputs:** schema states, Node action boundary, VM snapshot identifier.
- **Outputs:** Node provisioning action, sandbox mapping, explicit lifecycle transitions, snapshot builder script, mock adapter.
- **Verification commands:** mocked integration test; optional `npm run test:daytona` only with credentials; `npm run benchmark:provisioning` only with explicit approval/configuration.
- **Exit criteria:** a real test proves new threads receive distinct Daytona IDs from a VM-compatible prebuilt snapshot.
- **Dependencies:** Phase 1 and configured Daytona account.
- **Known risks:** account target may not support VM snapshots; record this as a blocker rather than substituting a container.

## Phase 3 — Pi runner inside the VM

- **Inputs:** verified official Pi API and prepared snapshot.
- **Outputs:** TypeScript runner, persistent `AgentSession`, private health/turn endpoint, Pi session storage in VM.
- **Verification commands:** runner contract tests; a real in-VM probe verifying Pi PID/cwd and session-file persistence.
- **Exit criteria:** Pi itself, not just a tool proxy, processes a prompt in the VM.
- **Dependencies:** Phase 2.
- **Known risks:** Pi package API/version changes; pin and compile against the installed package.

## Phase 4 — Streaming event bridge

- **Inputs:** runner endpoint and contracts.
- **Outputs:** normalized NDJSON events, authenticated Convex consumption, bounded batched persistence, partial content failure handling.
- **Verification commands:** contract test with chunked NDJSON; Convex function test; browser streaming test.
- **Exit criteria:** text and tool progress appear progressively in UI and remain inspectable after reload.
- **Dependencies:** Phase 1 and Phase 3.
- **Known risks:** action duration and backpressure; observe Convex action limits and cap payloads.

## Phase 5 — Required tools

- **Inputs:** runner, tool contract, provider settings.
- **Outputs:** Pi built-ins/factories for `bash`, `read`, `write`, `edit`, `grep`; custom `glob`, hardened `webfetch`, documented-provider `websearch`.
- **Verification commands:** per-tool unit/contract tests in a VM; private-address rejection tests for `webfetch`; configured-provider test for `websearch`.
- **Exit criteria:** all eight exact tool names execute in the VM and emit ordered structured records.
- **Dependencies:** Phase 3 and Phase 4; search provider key for real web search.
- **Known risks:** SSRF, unbounded outputs, and fabricated search responses; enforce safety and do not fake data.

## Phase 6 — Frontend observability and lifecycle

- **Inputs:** persisted lifecycle, message, and tool records.
- **Outputs:** thread list, composer state, chat stream, collapsible observability panel, timing metrics, retry/error affordances, accessibility coverage.
- **Verification commands:** `npm run typecheck`; Playwright interaction tests; keyboard navigation test.
- **Exit criteria:** the minimal UI shows VM ID/state, provisioning time, time to first token, and expandable ordered tool records.
- **Dependencies:** Phases 1, 2, and 4.
- **Known risks:** UI must remain small and not mask missing backend evidence with mocks.

## Phase 7 — Recovery, performance benchmark, E2E verification

- **Inputs:** integrated lifecycle, runner, and UI.
- **Outputs:** stop/resume reconciliation, duplicate-request protection, VM-isolation checks, provisioning benchmark, real Daytona E2E suite.
- **Verification commands:** `npm run test:daytona`; `npm run test:e2e`; `npm run benchmark:provisioning`.
- **Exit criteria:** acceptance evidence covers isolation, persistence, duplicate requests, streaming, and measured provisioning overhead.
- **Dependencies:** Phases 2–6 and external credentials.
- **Known risks:** billable resources and environmental flakiness; make these opt-in and clean up test sandboxes safely.

## Phase 8 — README and demo preparation

- **Inputs:** verified system and recorded metrics.
- **Outputs:** final README, environment guide review, cap.so demo script/recording, GitHub-ready handoff.
- **Verification commands:** final acceptance checklist in `docs/TESTING.md`; clean-clone `./init.sh`; manual demo rehearsal.
- **Exit criteria:** every passing feature has executed evidence and deliverables are consistent with the deployed behavior.
- **Dependencies:** Phases 0–7.
- **Known risks:** documentation claiming mocked or unverified behavior; retain explicit verification labels.

