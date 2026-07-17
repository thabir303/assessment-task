import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requiredFiles = [
  "AGENTS.md",
  ".env.example",
  "README.md",
  "feature_list.json",
  "docs/REQUIREMENTS.md",
  "docs/ARCHITECTURE.md",
  "docs/IMPLEMENTATION_PLAN.md",
  "docs/DECISIONS.md",
  "docs/ENVIRONMENT.md",
  "docs/TESTING.md",
  "docs/PROGRESS.md",
  "apps/web/src/app/page.tsx",
  "packages/contracts/src/agentEvents.ts",
  "sandbox/runner/src/server.ts"
];

const missing = requiredFiles.filter((file) => !existsSync(resolve(root, file)));
if (missing.length > 0) {
  throw new Error(`Missing required harness files: ${missing.join(", ")}`);
}

const features = JSON.parse(readFileSync(resolve(root, "feature_list.json"), "utf8"));
if (!Array.isArray(features) || features.length === 0) {
  throw new Error("feature_list.json must be a non-empty array.");
}

const ids = new Set();
for (const feature of features) {
  const keys = ["id", "priority", "phase", "category", "description", "acceptanceSteps", "passes", "evidence"];
  for (const key of keys) {
    if (!(key in feature)) {
      throw new Error(`Feature is missing ${key}: ${JSON.stringify(feature)}`);
    }
  }
  if (!/^[a-z0-9-]+$/.test(feature.id) || ids.has(feature.id)) {
    throw new Error(`Feature IDs must be unique stable kebab-case values: ${feature.id}`);
  }
  ids.add(feature.id);
  if (!Array.isArray(feature.acceptanceSteps) || feature.acceptanceSteps.length === 0) {
    throw new Error(`Feature ${feature.id} needs acceptance steps.`);
  }
  if (typeof feature.passes !== "boolean") {
    throw new Error(`Feature ${feature.id} must use a boolean passes value.`);
  }
  if (!feature.passes && feature.evidence !== null) {
    throw new Error(`Failing feature ${feature.id} must retain null evidence.`);
  }
  if (feature.passes && (typeof feature.evidence !== "string" || feature.evidence.trim().length === 0)) {
    throw new Error(`Passing feature ${feature.id} must include non-empty recorded evidence.`);
  }
}

const envExample = readFileSync(resolve(root, ".env.example"), "utf8");
for (const variable of [
  "NEXT_PUBLIC_CONVEX_URL",
  "CONVEX_DEPLOYMENT",
  "DAYTONA_API_KEY",
  "DAYTONA_API_URL",
  "DAYTONA_TARGET",
  "DAYTONA_SNAPSHOT=pi-agent-v1",
  "PI_PROVIDER",
  "PI_MODEL",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "WEB_SEARCH_PROVIDER=tavily",
  "TAVILY_API_KEY",
  "AGENT_RUNNER_PORT=8787",
  "MAX_ACTIVE_THREADS=10",
  "AGENT_TURN_TIMEOUT_MS=480000"
]) {
  if (!envExample.includes(variable)) {
    throw new Error(`.env.example is missing ${variable}`);
  }
}

const passingCount = features.filter((feature) => feature.passes).length;
console.log(`Harness structure valid: ${requiredFiles.length} required files, ${features.length} features (${passingCount} passing).`);
