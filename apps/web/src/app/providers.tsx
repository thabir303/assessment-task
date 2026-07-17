"use client";

import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { convexClient } from "../lib/convexClient";

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
  if (!convexClient) {
    return (
      <main className="shell">
        <section className="card">
          <h1>Convex is not configured</h1>
          <p>
            Set <code>NEXT_PUBLIC_CONVEX_URL</code> (run <code>npx convex dev</code> once) and restart the dev
            server.
          </p>
        </section>
      </main>
    );
  }

  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}
