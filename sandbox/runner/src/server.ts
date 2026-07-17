/**
 * Phase 3 implementation target.
 *
 * This in-VM service will own a persistent Pi AgentSession and expose a private,
 * per-thread-authenticated NDJSON interface. It is intentionally not started by
 * the initialization harness.
 */
export const runnerImplementationPhase = "phase-3-pi-runner-inside-the-vm" as const;
