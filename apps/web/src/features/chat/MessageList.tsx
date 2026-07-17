"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";

export function MessageList({ threadId }: { threadId: Id<"threads"> }) {
  const messages = useQuery(api.messages.list, { threadId }) ?? [];

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message._id} className={`message message-${message.author}`}>
          <span className="message-author">{message.author}</span>
          <p>
            {message.content}
            {message.isPartial ? <span className="message-cursor"> ▍</span> : null}
          </p>
        </div>
      ))}
      {messages.length === 0 ? <p className="message-empty">No messages yet. Say hello.</p> : null}
    </div>
  );
}
