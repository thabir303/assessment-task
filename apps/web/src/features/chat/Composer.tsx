"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { useState, type FormEvent } from "react";

interface ComposerProps {
  threadId: Id<"threads">;
  threadState: string;
}

export function Composer({ threadId, threadState }: ComposerProps) {
  const [text, setText] = useState("");
  const activeRun = useQuery(api.runs.getActive, { threadId });
  const startRun = useMutation(api.runs.start);

  const disabled = threadState !== "ready" || Boolean(activeRun);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;

    const clientRequestId = crypto.randomUUID();
    setText("");
    await startRun({ threadId, clientRequestId, text: trimmed });
  };

  return (
    <form className="composer" onSubmit={handleSubmit}>
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        disabled={disabled}
        placeholder={disabled ? "Waiting for the agent…" : "Message the agent"}
        aria-label="Message"
      />
      <button type="submit" disabled={disabled || text.trim().length === 0}>
        Send
      </button>
    </form>
  );
}
