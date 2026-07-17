export const threadStates = ["provisioning", "ready", "running", "stopped", "error"] as const;
export type ThreadState = (typeof threadStates)[number];

export const allowedThreadTransitions: Readonly<Record<ThreadState, readonly ThreadState[]>> = {
  provisioning: ["ready", "error"],
  ready: ["running", "stopped", "error"],
  running: ["ready", "error"],
  stopped: ["provisioning", "error"],
  error: ["provisioning", "stopped"]
};

