import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, test } from "vitest";

function runCli(args: string[]) {
  const cliPath = path.resolve(process.cwd(), "src/cli.ts");
  return spawnSync("bun", [cliPath, ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

describe("cli", () => {
  test("shows root help with command list", () => {
    const result = runCli(["--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Commands:");
    expect(result.stdout).toContain("add [...args]");
    expect(result.stdout).toContain("generate-lock [...args]");
  });

  test("shows subcommand help", () => {
    const result = runCli(["find", "--help"]);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage:");
    expect(result.stdout).toContain("$ skillet find [...args]");
  });

  test("prints version from environment override", () => {
    const cliPath = path.resolve(process.cwd(), "src/cli.ts");
    const result = spawnSync("bun", [cliPath, "--version"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, SKILLET_VERSION: "1.2.3" },
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("skillet/1.2.3");
  });

  test("returns clear error for unknown command", () => {
    const result = runCli(["nope"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown command: nope");
    expect(result.stderr).not.toContain("TypeError");
  });

  test("returns non-zero with clear message for invalid global flag", () => {
    const result = runCli(["--bogus"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Unknown option: --bogus");
  });
});
