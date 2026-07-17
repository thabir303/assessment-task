import path from "node:path";
import { defineTool } from "@mariozechner/pi-coding-agent";
import { glob } from "glob";
import { Type } from "typebox";

export function createGlobToolDefinition(cwd: string) {
  return defineTool({
    name: "glob",
    label: "Glob",
    description: "Find files matching a glob pattern (e.g. **/*.ts). Accepts an absolute path or a path relative to the working directory.",
    parameters: Type.Object({
      pattern: Type.String({ description: "Glob pattern to match, e.g. src/**/*.ts" }),
      path: Type.Optional(Type.String({ description: "Absolute path, or directory relative to the working directory, to search from. Defaults to the working directory." }))
    }),
    execute: async (_toolCallId, params) => {
      // Matches read/write/edit/grep: these tools operate anywhere in the sandbox filesystem,
      // since the sandbox itself (not a sub-path within it) is the isolation boundary.
      const searchRoot = params.path ? path.resolve(cwd, params.path) : cwd;
      const matches = await glob(params.pattern, { cwd: searchRoot, dot: false, nodir: false });
      const text = matches.length > 0 ? matches.slice(0, 500).join("\n") : "No matches found.";

      return {
        content: [{ type: "text" as const, text }],
        details: { matches: matches.slice(0, 500), count: matches.length }
      };
    }
  });
}
