# Pi-in-Daytona Chatbot Assessment

This repository is an incremental implementation harness for the Agentic Institute systems-design assessment. Its non-negotiable design is one Daytona VM-compatible sandbox per conversation, with the Pi agent process running inside that sandbox—not on the application host.

The current revision intentionally contains only the harness and a static frontend shell. It does not provision Daytona resources, start Pi, send messages, or claim a completed integration.

## Architecture at a glance

- Next.js App Router + React provides the minimal browser control plane.
- Convex will own reactive, UI-facing state and Node actions for external lifecycle effects.
- Each thread will map one-to-one to a private Daytona VM sandbox created from `pi-agent-v1`.
- A TypeScript runner inside that VM will embed Pi `AgentSession`, execute all tools, and emit normalized NDJSON.
- Convex will validate/persist event projections; the browser will not connect directly to Daytona or receive secrets.

See [requirements](docs/REQUIREMENTS.md), [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md), [implementation plan](docs/IMPLEMENTATION_PLAN.md), [environment guide](docs/ENVIRONMENT.md), and [testing strategy](docs/TESTING.md).

## Local startup

```sh
./init.sh
npm run dev
```

`./init.sh` installs declared packages only when missing, validates the harness, and never provisions a Daytona resource. Configure Convex and external credentials only when implementing the related phase; see `.env.example` and `docs/ENVIRONMENT.md`.

## Implementation discipline

All features begin as failing entries in `feature_list.json`. Implement one failing feature or tightly coupled vertical slice per session, execute its acceptance steps, then record concrete evidence before changing `passes` to `true`.

## External API baseline

The implementation will use the official [`@daytona/sdk`](https://www.daytona.io/docs/en/typescript-sdk/) (the older `@daytonaio/sdk` is deprecated), the official [Pi coding-agent SDK](https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md), and [Convex Node actions](https://docs.convex.dev/functions/actions). Versions must be re-checked against official sources before implementing an external integration.

