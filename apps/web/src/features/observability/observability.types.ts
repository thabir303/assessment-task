export interface ToolExecutionView {
  id: string;
  sequence: number;
  name: string;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: string | null;
  completedAt: string | null;
  input: unknown;
  output: unknown;
  error: string | null;
}
