"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";

interface ThreadListProps {
  selectedThreadId: Id<"threads"> | null;
  onSelect: (threadId: Id<"threads">) => void;
}

export function ThreadList({ selectedThreadId, onSelect }: ThreadListProps) {
  const threads = useQuery(api.threads.list) ?? [];
  const createThread = useMutation(api.threads.create);

  const handleCreate = async () => {
    const clientRequestId = crypto.randomUUID();
    const title = `Conversation ${new Date().toLocaleTimeString()}`;
    const { threadId } = await createThread({ title, clientRequestId });
    onSelect(threadId);
  };

  return (
    <aside className="thread-list">
      <button type="button" onClick={handleCreate}>
        New conversation
      </button>
      <ul>
        {threads.map((thread) => (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() => onSelect(thread.id)}
              aria-current={thread.id === selectedThreadId}
              className="thread-item"
            >
              <span>{thread.title}</span>
              <span className="thread-state">{thread.state}</span>
            </button>
          </li>
        ))}
        {threads.length === 0 ? <li className="thread-empty">No conversations yet.</li> : null}
      </ul>
    </aside>
  );
}
