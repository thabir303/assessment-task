import dns from "node:dns/promises";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { fetchWithRetry } from "../net.js";
import { ALLOWED_FETCH_SCHEMES, isPrivateOrReservedAddress } from "../security/ssrf.js";

const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 15_000;

async function assertPublicHost(hostname: string): Promise<void> {
  const records = await dns.lookup(hostname, { all: true }).catch(() => []);
  if (records.length === 0) {
    throw new Error(`could not resolve host: ${hostname}`);
  }
  for (const record of records) {
    if (isPrivateOrReservedAddress(record.address)) {
      throw new Error(`refusing to fetch private/reserved address for host: ${hostname}`);
    }
  }
}

async function safeFetch(initialUrl: string): Promise<{ url: string; status: number; body: string; truncated: boolean }> {
  let currentUrl = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const parsed = new URL(currentUrl);
    if (!ALLOWED_FETCH_SCHEMES.has(parsed.protocol)) {
      throw new Error(`unsupported URL scheme: ${parsed.protocol}`);
    }
    await assertPublicHost(parsed.hostname);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetchWithRetry(parsed, { redirect: "manual", signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error(`redirect response missing Location header (status ${response.status})`);
      }
      currentUrl = new URL(location, parsed).toString();
      continue;
    }

    const reader = response.body?.getReader();
    let received = 0;
    let truncated = false;
    const chunks: Uint8Array[] = [];
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.byteLength;
        if (received > MAX_RESPONSE_BYTES) {
          truncated = true;
          await reader.cancel();
          break;
        }
        chunks.push(value);
      }
    }
    const body = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString("utf-8");
    return { url: parsed.toString(), status: response.status, body, truncated };
  }

  throw new Error(`too many redirects (max ${MAX_REDIRECTS})`);
}

export function createWebFetchToolDefinition() {
  return defineTool({
    name: "webfetch",
    label: "Web Fetch",
    description: "Fetch the content of a public http(s) URL. Rejects private, loopback, and link-local addresses.",
    parameters: Type.Object({
      url: Type.String({ description: "The http(s) URL to fetch" })
    }),
    execute: async (_toolCallId, params) => {
      const result = await safeFetch(params.url);
      const text = result.truncated
        ? `${result.body}\n\n[truncated at ${MAX_RESPONSE_BYTES} bytes]`
        : result.body;

      return {
        content: [{ type: "text" as const, text: text.length > 0 ? text : `(empty response, status ${result.status})` }],
        details: { url: result.url, status: result.status, truncated: result.truncated }
      };
    }
  });
}
