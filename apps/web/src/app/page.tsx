"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Composer } from "../features/chat/Composer";
import { MessageList } from "../features/chat/MessageList";
import { ToolTimeline } from "../features/observability/ToolTimeline";
import { ThreadList } from "../features/threads/ThreadList";

export default function HomePage() {
  const [selectedThreadId, setSelectedThreadId] = useState<Id<"threads"> | null>(null);
  const thread = useQuery(api.threads.get, selectedThreadId ? { threadId: selectedThreadId } : "skip");
  const stopThread = useMutation(api.threads.stop);
  const resumeThread = useMutation(api.threads.resume);

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
                {thread.state === "ready" ? (
                  <button type="button" className="vm-control" onClick={() => stopThread({ threadId: selectedThreadId })}>
                    Stop VM
                  </button>
                ) : null}
                {thread.state === "stopped" ? (
                  <button type="button" className="vm-control" onClick={() => resumeThread({ threadId: selectedThreadId })}>
                    Resume VM
                  </button>
                ) : null}
                {thread.state === "error" ? (
                  <button type="button" className="vm-control" onClick={() => resumeThread({ threadId: selectedThreadId })}>
                    Retry
                  </button>
                ) : null}
                {thread.state === "provisioning" ? " · reconnecting…" : ""}
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
