export const threadStates = ["provisioning", "ready", "running", "stopped", "error"] as const;
export type ThreadState = (typeof threadStates)[number];

/**
 * Allowed `thread.state` transitions.
 *
 * `provisioning` includes itself so the resume/retry mutations are idempotent: if a user
 * double-clicks Resume while a previous attempt is still provisioning, the second call
 * resolves to the same logical state instead of throwing. The handler still guards against
 * duplicate side effects (it short-circuits without re-scheduling the action), but the
 * transition table is the source of truth for what *can* change in the DB, and treating
 * `provisioning -> provisioning` as a valid no-op keeps the contract honest.
 */
export const allowedThreadTransitions: Readonly<Record<ThreadState, readonly ThreadState[]>> = {
  provisioning: ["ready", "error", "provisioning"],
  ready: ["running", "stopped", "error"],
  running: ["ready", "error"],
  stopped: ["provisioning", "error"],
  error: ["provisioning", "stopped"]
};

