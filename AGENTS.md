# Agent Working Agreement

This repository is a deliberately incremental implementation of the Agentic Institute systems-design assessment. The assessment is the source of product truth; `docs/REQUIREMENTS.md` is its normalized form. Keep the control plane and execution plane separate: Pi runs inside the dedicated Daytona VM for its thread.

## Session startup (mandatory)

1. Run `pwd`.
2. Read this file.
3. Read `docs/PROGRESS.md`.
4. Read `feature_list.json`.
5. Read recent Git history and `git status`.
6. Read the architecture and decision documents relevant to the chosen feature.
7. Run `./init.sh`.
8. Run the baseline smoke test before modifying code.
9. If the smoke test reveals a regression, fix that regression before beginning a new feature.

## Session execution rules

- Implement exactly one failing feature, or one tightly coupled vertical slice, per session.
- Do not change a feature description or acceptance steps in `feature_list.json` unless the assessment changes. Update only `passes` and `evidence` after executing the acceptance steps.
- Verify uncertain external APIs in current official documentation before coding against them.
- Do not provision billable Daytona resources during routine local checks.
- Never expose Daytona, model-provider, search-provider, or runner credentials to browser code or client-readable Convex records.
- Keep shared runner-to-control-plane event contracts in `packages/contracts`.
- Do not treat mocks or code inspection as evidence that a real integration works.

## Session shutdown (mandatory)

1. Run relevant unit, integration, typecheck, lint, and E2E tests.
2. Update feature status only with recorded evidence.
3. Append a handoff entry to `docs/PROGRESS.md`.
4. Update architecture or decisions only when they actually changed.
5. Ensure no secrets, temporary debugging code, or unrelated changes remain.
6. Leave the repository runnable.
7. Create a descriptive Git commit only when it is safe and does not include unrelated user changes.

