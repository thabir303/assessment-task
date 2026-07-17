# Testing Strategy and Final Acceptance

The test suite is introduced incrementally. A test category is not proof of the next category; mocked and real Daytona checks remain distinct.

| Layer | Scope | Required evidence |
| --- | --- | --- |
| Unit tests | Pure validation, state transitions, NDJSON parsing, output limits, URL safety, and custom tools. | Deterministic test output. |
| Convex function tests | Schema validators, indexes, idempotency, one-active-run rule, and event-persistence mutations. | Convex test run against isolated test data. |
| Runner contract tests | Request authentication, event ordering, schema validation, text/tool terminal states, and bounded payloads. | Runner test suite without Daytona. |
| Mocked Daytona integration | Provisioning/reconciliation against a typed SDK adapter fake. | Recorded expected lifecycle calls and state transitions. |
| Real Daytona integration | Create, health-check, stop, resume, and safely delete a sandbox on an explicitly configured account. | Sandbox ID, target, snapshot, times, and cleanup result; never secrets. |
| Playwright browser E2E | Thread creation, composer availability, streaming UI, observability expansion, retry/error, and keyboard navigation. | Test report/screenshots against an integration deployment. |
| VM isolation test | Create threads A/B, write a sentinel in A, verify B cannot read it. | Different Daytona IDs plus failed B access assertion. |
| Stop/resume persistence | Persist a Pi/VM sentinel, stop the mapped sandbox, resume it, and verify same sandbox/session/files. | Recorded sandbox ID and before/after evidence. |
| Streaming test | Ensure text deltas and a tool lifecycle record are observable before terminal completion. | Timestamped event sequence and UI assertion. |
| Duplicate-request test | Send same `clientRequestId` twice and prove one run/provisioning side effect. | Database assertion and adapter call count. |
| Performance benchmark | Measure from request start to sandbox-ready for a prebuilt snapshot over a documented sample. | Raw samples, summary, target/snapshot, and methodology. |

## Commands (introduced as their phases land)

```sh
./init.sh
npm run check:structure
npm run typecheck
npm run lint
npm run test -- --run
npm run test:daytona
npm run test:e2e
npm run benchmark:provisioning
```

`test:daytona`, `test:e2e`, and `benchmark:provisioning` must refuse to run without explicitly configured credentials/opt-in settings. They may create billable resources, so routine local smoke checks must not invoke them.

## Final assessment acceptance checklist

- [ ] The application uses TypeScript, Next.js App Router + React, and Convex.
- [ ] A new conversation creates one dedicated Daytona VM/Sandbox from the prebuilt snapshot.
- [ ] Two threads have different Daytona IDs.
- [ ] Pi is demonstrably running inside the mapped Daytona VM.
- [ ] Control plane and execution plane are separate; Pi is not hosted on the application host.
- [ ] Thread A cannot read Thread B's filesystem sentinel.
- [ ] Message history, tool history, thread-to-VM mapping, and run state are inspectable.
- [ ] Assistant text is visible progressively before completion.
- [ ] All exact required tools exist: `bash`, `read`, `write`, `edit`, `grep`, `glob`, `webfetch`, `websearch`.
- [ ] Tool records expose name, input, output, status, order, timing, and error state.
- [ ] Tool execution order and outputs are visible in the UI.
- [ ] Stop/resume retains VM and Pi-session state.
- [ ] Duplicate client requests do not create duplicate active runs or sandboxes.
- [ ] Provisioning overhead for the prebuilt snapshot is measured and documented.
- [ ] Browser clients never receive Daytona/model/search credentials, preview tokens, or runner tokens.
- [ ] The README, environment documentation, source repository, and cap.so demo are consistent with real evidence.

