export type ThreadLifecycleState = "provisioning" | "ready" | "running" | "stopped" | "error";

export interface ThreadSummary {
  id: string;
  title: string;
  state: ThreadLifecycleState;
  sandboxId: string | null;
  provisioningDurationMs: number | null;
}
