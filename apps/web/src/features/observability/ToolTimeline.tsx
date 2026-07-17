"use client";

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { ToolIcon } from "./ToolIcon";

interface ContentBlock {
  type?: string;
  text?: string;
}

function extractText(value: unknown): string | null {
  if (value && typeof value === "object" && "content" in value) {
    const content = (value as { content?: unknown }).content;
    if (Array.isArray(content)) {
      const text = (content as ContentBlock[])
        .filter((block) => block?.type === "text" && typeof block.text === "string")
        .map((block) => block.text as string)
        .join("\n");
      if (text.length > 0) return text;
    }
  }
  return null;
}

function formatFields(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>).map(([key, val]) => {
    const rendered = typeof val === "string" ? val : JSON.stringify(val);
    return [key, rendered.length > 200 ? `${rendered.slice(0, 200)}…` : rendered];
  });
}

function formatDuration(startedAt?: number, completedAt?: number): string | null {
  if (!startedAt || !completedAt) return null;
  const ms = completedAt - startedAt;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function ToolTimeline({ threadId }: { threadId: Id<"threads"> }) {
  const toolExecutions = useQuery(api.toolExecutions.list, { threadId }) ?? [];

  if (toolExecutions.length === 0) return null;

  return (
    <section className="tool-timeline" aria-labelledby="tool-timeline-title">
      <div className="tool-timeline-header">
        <h2 id="tool-timeline-title">Tool activity</h2>
        <span className="tool-timeline-count">{toolExecutions.length}</span>
      </div>
      <ol>
        {toolExecutions.map((execution) => {
          const duration = formatDuration(execution.startedAt, execution.completedAt);
          const outputText = extractText(execution.output);
          const inputFields = formatFields(execution.input);

          return (
            <li key={execution._id} className={`tool-row tool-row-${execution.status}`}>
              <span className={`tool-status-dot tool-status-dot-${execution.status}`} aria-hidden="true" />
              <div className="tool-row-body">
                <div className="tool-row-summary">
                  <span className="tool-icon">
                    <ToolIcon name={execution.name} />
                  </span>
                  <code className="tool-name">{execution.name}</code>
                  <span className={`tool-badge tool-badge-${execution.status}`}>{execution.status}</span>
                  {duration ? <span className="tool-duration">{duration}</span> : null}
                </div>

                {execution.status === "running" && execution.streamingOutput ? (
                  <pre className="tool-live-output" aria-label="live tool output">
                    {execution.streamingOutput}
                  </pre>
                ) : null}

                <details className="tool-details">
                  <summary>Details</summary>
                  {inputFields.length > 0 ? (
                    <dl className="tool-field-list">
                      {inputFields.map(([key, val]) => (
                        <div key={key} className="tool-field">
                          <dt>{key}</dt>
                          <dd>{val}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                  {outputText ? <pre className="tool-output-block">{outputText}</pre> : null}
                  {execution.error ? <p className="tool-error-block">{execution.error}</p> : null}
                </details>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
