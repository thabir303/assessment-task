import { allowedThreadTransitions, type ThreadState } from "@agentic/contracts";

export function assertTransition(from: ThreadState, to: ThreadState): void {
  if (!allowedThreadTransitions[from].includes(to)) {
    throw new Error(`invalid thread state transition: ${from} -> ${to}`);
  }
}

export type { ThreadState };
