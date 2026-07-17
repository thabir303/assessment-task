import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { fetchWithRetry } from "../net.js";

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

interface TavilyResponse {
  answer?: string;
  results?: TavilyResult[];
}

export interface WebSearchConfig {
  provider: string;
  apiKey: string | undefined;
}

export function createWebSearchToolDefinition(config: WebSearchConfig) {
  return defineTool({
    name: "websearch",
    label: "Web Search",
    description: "Search the web using the configured search provider and return real results.",
    parameters: Type.Object({
      query: Type.String({ description: "Search query" }),
      maxResults: Type.Optional(Type.Number({ description: "Maximum number of results to return (default 5)" }))
    }),
    execute: async (_toolCallId, params) => {
      if (config.provider !== "tavily") {
        throw new Error(`unsupported WEB_SEARCH_PROVIDER: ${config.provider}`);
      }
      if (!config.apiKey) {
        throw new Error("TAVILY_API_KEY is not configured for this sandbox");
      }

      const maxResults = params.maxResults ?? 5;
      const response = await fetchWithRetry("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: config.apiKey,
          query: params.query,
          max_results: maxResults,
          include_answer: true
        })
      });

      if (!response.ok) {
        throw new Error(`websearch provider request failed: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as TavilyResponse;
      const results = data.results ?? [];
      const lines = results.map((result, index) => `${index + 1}. ${result.title ?? "(untitled)"} — ${result.url ?? ""}\n${result.content ?? ""}`);
      const text = [data.answer, ...lines].filter(Boolean).join("\n\n") || "No results found.";

      return {
        content: [{ type: "text" as const, text }],
        details: { query: params.query, resultCount: results.length, results }
      };
    }
  });
}
