# Architecture Decision Records

## ADR-001 — Pi runs inside each Daytona VM

**Status:** accepted  
**Decision:** The runner process and embedded Pi `AgentSession` execute in the dedicated Daytona VM assigned to the thread.  
**Why:** The assessment explicitly requires agent execution inside the isolated environment, not merely remote tool calls.  
**Consequence:** Runner startup, model credentials, and Pi session persistence are VM concerns; Convex only orchestrates and projects events.

## ADR-002 — Do not use `@daytona/pi` as the core integration

**Status:** accepted  
**Decision:** Use the official Pi SDK inside a custom in-VM TypeScript runner.  
**Why:** The ready-made extension's documented host-side Pi placement does not meet the assessment's execution-plane boundary.  
**Consequence:** The project owns a small runner protocol and its contract tests.

## ADR-003 — Browser never connects to a Daytona VM

**Status:** accepted  
**Decision:** Browser communication ends at Convex; Convex Node actions communicate privately with runners.  
**Why:** This keeps Daytona credentials, preview tokens, runner tokens, and provider keys out of the browser and centralizes observability.  
**Consequence:** Convex persists normalized stream projections and serves reactive UI state.

## ADR-004 — Convex stores projections, not the VM filesystem

**Status:** accepted  
**Decision:** Convex holds messages, runs, tool records, mapping, and lifecycle metadata, but not a copy of arbitrary VM files.  
**Why:** The VM is the execution-state authority; duplicating files would be expensive, stale, and outside the assessment.  
**Consequence:** Inspection of files belongs to in-VM Pi tools; UI observability remains event-focused.

## ADR-005 — Prebuilt Daytona snapshot is required

**Status:** accepted  
**Decision:** Provision every conversation from the verified `pi-agent-v1` VM-compatible snapshot.  
**Why:** Installing runner/Pi dependencies per thread would dominate provisioning time and fail the performance objective.  
**Consequence:** Snapshot construction and its cold-start benchmark are explicit deliverables.

## ADR-006 — Persist streaming through Convex

**Status:** accepted  
**Decision:** The runner emits bounded NDJSON, and Convex batches it into durable reactive records.  
**Why:** It preserves UI progress and observability across refreshes without direct VM exposure.  
**Consequence:** Partial text must be persisted before run completion and remain after errors.

## ADR-007 — One active run per thread

**Status:** accepted  
**Decision:** Enforce a single `running` run per thread with an idempotent client request ID.  
**Why:** A persistent Pi session has ordered conversation semantics; concurrent prompts would make tool/message order ambiguous.  
**Consequence:** The composer disables while a run is active, while independent threads remain concurrent.

