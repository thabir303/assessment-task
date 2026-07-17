# Requirements

Source: `Systems design assessment.md`. This document normalizes, but does not expand, the assessment.

## Objective

Build a minimal TypeScript chatbot that demonstrates a Pi Agent running inside an isolated Daytona environment. The assessment prioritizes architecture and system design over feature breadth. Convex is the backend runtime and data layer.

## Functional requirements

| ID | Requirement | Assessment trace |
| --- | --- | --- |
| FR-1 | Provide a basic unauthenticated interface that can create a thread and send/receive messages. | Chat Interface |
| FR-2 | Create one dedicated Daytona VM/Sandbox when a thread is created, and initialize Pi in that environment. | Conversation Lifecycle; Core Concept |
| FR-3 | Keep message history, tool execution history, VM/session state, and thread-to-VM mapping. | Conversation Lifecycle; Backend & Data Layer |
| FR-4 | Run Pi itself inside the Daytona environment; orchestration remains external. | Agent Execution Model |
| FR-5 | Expose exactly these agent tools: `bash`, `read`, `write`, `edit`, `grep`, `glob`, `webfetch`, and `websearch`. | Tooling Support |
| FR-6 | Return structured tool output and progressively expose tool output where feasible. | Tooling Support |
| FR-7 | Progressively stream assistant messages where feasible. | Chat Interface |
| FR-8 | Use Convex for conversation state, message storage, tool logs, and session mapping. | Backend & Data Layer |
| FR-9 | Show message history and ordered tool usage, including tool name, input, output, and execution order. | Observability |

## Non-functional requirements

| ID | Requirement | Assessment trace |
| --- | --- | --- |
| NFR-1 | Use TypeScript throughout. | Objective |
| NFR-2 | Use Next.js App Router, React, TypeScript, and Convex. | Initializer constraints |
| NFR-3 | Keep control plane (browser, Next.js, Convex) separate from execution plane (Pi and its tools in Daytona). | Agent Execution Model |
| NFR-4 | Use a prebuilt Daytona snapshot to minimize provisioning overhead. | Evaluation Criteria; initializer constraints |
| NFR-5 | Make behavior inspectable through durable, ordered observability records. | Observability; Evaluation Criteria |
| NFR-6 | Keep the solution simple; authentication, advanced polish, multi-agent orchestration, and production hardening are excluded. | Non-Goals |

## Evaluation criteria

1. Architecture quality: correct Pi placement, clean plane separation, and coherent session lifecycle.
2. Performance: minimal Daytona startup overhead.
3. System design: thread-to-VM mapping, state management, extensibility.
4. Observability: understandable histories and logs.
5. Implementation clarity: simple, correct organization.

## Deliverables

- A demo recorded with cap.so.
- Source code published through GitHub.
- A consistent README covering architecture decisions, component interactions, and trade-offs.
- A complete list of environment variables.

## Explicit non-goals

- Authentication and user management.
- Advanced UI/UX polish.
- Large tool sets or complex capabilities beyond the required eight tools.
- Production-scale hardening.
- Multi-agent orchestration, teams, billing, themes, social features, and file uploads.

## Open assumptions

- The assessor will supply valid Daytona, model-provider, and web-search credentials for real integration testing.
- The configured Daytona target supports a VM-compatible snapshot. If it cannot, the implementation must record the blocker rather than silently substituting a container.
- The exact model selected through `PI_PROVIDER` and `PI_MODEL` is deployment configuration, not a product requirement.
- The runner transport will be a private HTTP endpoint with NDJSON events, subject to validating its Daytona reachability during Phase 3. This preserves the required architecture without exposing runner access to browsers.

