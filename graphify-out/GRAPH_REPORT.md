# Graph Report - .  (2026-07-17)

## Corpus Check
- Corpus is ~562 words - fits in a single context window. You may not need a graph.

## Summary
- 26 nodes · 26 edges · 6 communities (3 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 804 input · 2,557 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Agent Tooling|Agent Tooling]]
- [[_COMMUNITY_Thread State and Observability|Thread State and Observability]]
- [[_COMMUNITY_Assessment Deliverables|Assessment Deliverables]]
- [[_COMMUNITY_Plane Separation|Plane Separation]]
- [[_COMMUNITY_Streaming Outputs|Streaming Outputs]]
- [[_COMMUNITY_Chat Interface|Chat Interface]]

## God Nodes (most connected - your core abstractions)
1. `Pi Agent` - 10 edges
2. `Agentic Institute – Systems design assessment` - 6 edges
3. `Convex` - 4 edges
4. `Conversation (Thread)` - 4 edges
5. `Message History` - 3 edges
6. `Tool Execution History` - 3 edges
7. `Daytona Session (VM)` - 2 edges
8. `Execution Plane` - 2 edges
9. `Observability` - 2 edges
10. `Control Plane` - 1 edges

## Surprising Connections (you probably didn't know these)
- `Agentic Institute – Systems design assessment` --references--> `Pi Agent`  [EXTRACTED]
  Systems design assessment.md → Systems design assessment.md  _Bridges community 2 → community 0_
- `Agentic Institute – Systems design assessment` --references--> `Daytona Session (VM)`  [EXTRACTED]
  Systems design assessment.md → Systems design assessment.md  _Bridges community 2 → community 1_
- `Pi Agent` --implements--> `Execution Plane`  [EXTRACTED]
  Systems design assessment.md → Systems design assessment.md  _Bridges community 0 → community 3_

## Hyperedges (group relationships)
- **Conversation Session Agent Lifecycle** — systems_design_assessment_conversation_thread, systems_design_assessment_daytona_session, systems_design_assessment_pi_agent [EXTRACTED 1.00]

## Communities (6 total, 3 thin omitted)

### Community 0 - "Agent Tooling"
Cohesion: 0.22
Nodes (9): bash, edit, glob, grep, Pi Agent, read, webfetch, websearch (+1 more)

### Community 1 - "Thread State and Observability"
Cohesion: 0.32
Nodes (8): Conversation (Thread), Convex, Daytona Session (VM), Message History, Observability, Session–VM Mapping, Tool Execution History, VM/Session State

### Community 2 - "Assessment Deliverables"
Cohesion: 0.50
Nodes (4): Agentic Institute – Systems design assessment, cap.so, GitHub, README

## Knowledge Gaps
- **17 isolated node(s):** `Control Plane`, `Chat Interface`, `Session–VM Mapping`, `VM/Session State`, `Structured Tool Outputs` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Pi Agent` connect `Agent Tooling` to `Assessment Deliverables`, `Plane Separation`?**
  _High betweenness centrality (0.547) - this node is a cross-community bridge._
- **Why does `Agentic Institute – Systems design assessment` connect `Assessment Deliverables` to `Agent Tooling`, `Thread State and Observability`?**
  _High betweenness centrality (0.500) - this node is a cross-community bridge._
- **Why does `Convex` connect `Thread State and Observability` to `Assessment Deliverables`?**
  _High betweenness centrality (0.221) - this node is a cross-community bridge._
- **What connects `Control Plane`, `Chat Interface`, `Session–VM Mapping` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._