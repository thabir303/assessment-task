"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { useState } from "react";
import { Composer } from "../features/chat/Composer";
import { MessageList } from "../features/chat/MessageList";
import { ToolTimeline } from "../features/observability/ToolTimeline";
import { ThreadList } from "../features/threads/ThreadList";

export default function HomePage() {
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);
  const thread = useQuery(api.threads.get, selectedThreadId ? { threadId: selectedThreadId } : "skip");

  return (
    <main className="shell">
      <ThreadList selectedThreadId={selectedThreadId} onSelect={setSelectedThreadId} />

      <section className="chat">
        {selectedThreadId && thread ? (
          <>
            <header className="chat-header">
              <h1>{thread.title}</h1>
              <p className="chat-meta">
                state: <strong>{thread.state}</strong>
                {thread.sandboxId ? ` · sandbox ${thread.sandboxId}` : ""}
                {thread.provisioningDurationMs !== null ? ` · provisioned in ${thread.provisioningDurationMs}ms` : ""}
              </p>
              {thread.lastError ? (
                <p className="chat-error" role="alert">
                  {thread.lastError}
                </p>
              ) : null}
            </header>

            <MessageList threadId={selectedThreadId} />
            <Composer threadId={selectedThreadId} threadState={thread.state} />
            <ToolTimeline threadId={selectedThreadId} />
          </>
        ) : (
          <p className="chat-placeholder">Select or create a conversation to begin.</p>
        )}
      </section>
    </main>
  );
}
