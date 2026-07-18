import { describe, expect, it } from "vitest";
import { allowedThreadTransitions, threadStates, type ThreadState } from "./lifecycle.js";

describe("allowedThreadTransitions", () => {
  it("covers every thread state exactly once on the left-hand side", () => {
    const keys = Object.keys(allowedThreadTransitions).sort();
    expect(keys).toEqual([...threadStates].sort());
  });

  it("treats provisioning -> provisioning as a valid idempotent no-op", () => {
    expect(allowedThreadTransitions.provisioning).toContain("provisioning");
  });

  it.each<[ThreadState, ThreadState]>([
    ["ready", "provisioning"],
    ["running", "provisioning"],
    ["stopped", "ready"],
    ["error", "ready"],
  ])("rejects invalid transition %s -> %s", (from, to) => {
    expect(allowedThreadTransitions[from]).not.toContain(to);
  });
});