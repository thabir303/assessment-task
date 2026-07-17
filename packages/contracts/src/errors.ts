export type DomainErrorCode =
  | "configuration_invalid"
  | "duplicate_request"
  | "invalid_state_transition"
  | "runner_authentication_failed"
  | "runner_protocol_invalid"
  | "sandbox_unavailable"
  | "tool_execution_failed";

export interface DomainError {
  code: DomainErrorCode;
  message: string;
  retryable: boolean;
}

