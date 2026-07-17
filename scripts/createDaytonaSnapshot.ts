/**
 * Builds the `pi-agent-v1` Daytona snapshot: a Node.js image with the compiled
 * sandbox runner and its dependencies preinstalled, so per-thread sandbox creation
 * (Milestone A3) never pays an install cost (see docs/DECISIONS.md ADR-005).
 *
 * This is opt-in and billable. Never invoked by ./init.sh or npm run dev.
 *
 * Usage:
 *   npm run build --workspace=@agentic/contracts
 *   npm run build --workspace=@agentic/sandbox-runner
 *   node --experimental-strip-types scripts/createDaytonaSnapshot.ts
 */
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Daytona, Image } from "@daytona/sdk";

const required = ["DAYTONA_API_KEY", "DAYTONA_TARGET"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length > 0) {
  console.error(`createDaytonaSnapshot requires ${missing.join(", ")} in the process environment.`);
  process.exit(1);
}

const repoRoot = path.resolve(import.meta.dirname, "..");
const contractsDist = path.join(repoRoot, "packages/contracts/dist");
const runnerDist = path.join(repoRoot, "sandbox/runner/dist");
const runnerPackageJsonPath = path.join(repoRoot, "sandbox/runner/package.json");

if (!existsSync(path.join(contractsDist, "index.js"))) {
  console.error("packages/contracts is not built. Run `npm run build --workspace=@agentic/contracts` first.");
  process.exit(1);
}
if (!existsSync(path.join(runnerDist, "server.js"))) {
  console.error("sandbox/runner is not built. Run `npm run build --workspace=@agentic/sandbox-runner` first.");
  process.exit(1);
}

const snapshotName = process.env.DAYTONA_SNAPSHOT ?? "pi-agent-v1";
const scratchDir = mkdtempSync(path.join(tmpdir(), "pi-agent-snapshot-"));

// The runner's real package.json declares @agentic/contracts as a workspace dependency
// (resolved locally by npm workspaces). That name does not exist on the public registry,
// so the image-build package.json used for `npm install` omits it; the compiled contracts
// dist is placed into node_modules directly instead (see addLocalDir below).
const runnerPackageJson = JSON.parse(readFileSync(runnerPackageJsonPath, "utf-8"));
delete runnerPackageJson.dependencies["@agentic/contracts"];
const imagePackageJsonPath = path.join(scratchDir, "package.json");
writeFileSync(imagePackageJsonPath, JSON.stringify(runnerPackageJson, null, 2));

const contractsPackageJsonPath = path.join(scratchDir, "contracts-package.json");
writeFileSync(
  contractsPackageJsonPath,
  JSON.stringify({ name: "@agentic/contracts", version: "0.1.0", type: "module", main: "./index.js", exports: { ".": "./index.js" } }, null, 2)
);

const image = Image.base("node:22-slim")
  .workdir("/workspace")
  // Pi's built-in grep tool shells out to ripgrep and downloads it at runtime if missing from
  // PATH (see @mariozechner/pi-coding-agent's tools-manager.js). Baking it into the image here
  // avoids a runtime network dependency for a required tool (same rationale as the prebuilt
  // snapshot itself -- see docs/DECISIONS.md ADR-005).
  .runCommands("apt-get update && apt-get install -y --no-install-recommends ripgrep ca-certificates && rm -rf /var/lib/apt/lists/*")
  .addLocalFile(imagePackageJsonPath, "/workspace/package.json")
  .runCommands("npm install --omit=dev")
  .addLocalDir(contractsDist, "/workspace/node_modules/@agentic/contracts")
  .addLocalFile(contractsPackageJsonPath, "/workspace/node_modules/@agentic/contracts/package.json")
  .addLocalDir(runnerDist, "/workspace/dist")
  .env({ NODE_ENV: "production" });

async function main(): Promise<void> {
  const daytona = new Daytona();

  const existing = await daytona.snapshot.get(snapshotName).catch(() => undefined);
  if (existing) {
    console.log(`Snapshot "${snapshotName}" already exists -- deleting it before rebuilding.`);
    await daytona.snapshot.delete(existing);

    const deleteDeadline = Date.now() + 60_000;
    while (Date.now() < deleteDeadline) {
      const stillThere = await daytona.snapshot.get(snapshotName).catch(() => undefined);
      if (!stillThere) break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  console.log(`Building snapshot "${snapshotName}" from ${runnerDist} ...`);
  await daytona.snapshot.create(
    {
      name: snapshotName,
      image,
      resources: { cpu: 1, memory: 2, disk: 5 }
    },
    { onLogs: (chunk) => process.stdout.write(chunk) }
  );

  console.log(`\nSnapshot "${snapshotName}" is ready. Set DAYTONA_SNAPSHOT=${snapshotName} in the Convex deployment environment.`);
}

main().catch((error) => {
  console.error("Snapshot build failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
