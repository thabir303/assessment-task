import type { ReactNode } from "react";

/**
 * Phase 1 will place ConvexProvider and application-level state providers here.
 * Keeping this boundary now prevents the layout from coupling to future clients.
 */
export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  return children;
}
