import { execFileSync, spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("npm package bundle", () => {
  it("builds a node-compatible cli bundle", () => {
    execFileSync("bun", ["scripts/build-npm-cli.ts"], {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    const bundledCli = path.resolve(process.cwd(), "dist/npm/cli.js");
    const result = spawnSync("node", [bundledCli, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("$ skillet <command> [options]");
  });
});
