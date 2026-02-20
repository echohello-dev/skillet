import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runInitCommand } from "../../src/commands/init";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("runInitCommand", () => {
  test("creates SKILL.md in current directory", () => {
    const root = makeTempDir("skillet-init-");
    const cwd = path.join(root, "alpha-skill");
    fs.mkdirSync(cwd, { recursive: true });

    const output: string[] = [];
    const exitCode = runInitCommand([], {
      cwd,
      yes: false,
      stdout: (line) => output.push(line),
      stderr: () => undefined,
    });

    const skillFile = path.join(cwd, "SKILL.md");
    expect(exitCode).toBe(0);
    expect(fs.existsSync(skillFile)).toBe(true);
    expect(fs.readFileSync(skillFile, "utf8")).toContain("name: alpha-skill");
    expect(output[0]).toContain("Created");
  });

  test("creates SKILL.md in specified directory", () => {
    const root = makeTempDir("skillet-init-");
    const cwd = root;

    const output: string[] = [];
    const exitCode = runInitCommand(["beta-skill"], {
      cwd,
      yes: false,
      stdout: (line) => output.push(line),
      stderr: () => undefined,
    });

    const skillFile = path.join(cwd, "beta-skill", "SKILL.md");
    expect(exitCode).toBe(0);
    expect(fs.readFileSync(skillFile, "utf8")).toContain("name: beta-skill");
    expect(fs.readFileSync(skillFile, "utf8")).toContain("description:");
  });

  test("does not overwrite existing SKILL.md without confirmation", () => {
    const root = makeTempDir("skillet-init-");
    const cwd = path.join(root, "gamma-skill");
    fs.mkdirSync(cwd, { recursive: true });
    const skillFile = path.join(cwd, "SKILL.md");
    fs.writeFileSync(skillFile, "existing");

    const errors: string[] = [];
    const exitCode = runInitCommand([], {
      cwd,
      yes: false,
      confirmOverwrite: () => false,
      stdout: () => undefined,
      stderr: (line) => errors.push(line),
    });

    expect(exitCode).toBe(1);
    expect(fs.readFileSync(skillFile, "utf8")).toBe("existing");
    expect(errors.join("\n")).toContain("already exists");
  });

  test("overwrites existing SKILL.md when --yes is set", () => {
    const root = makeTempDir("skillet-init-");
    const cwd = path.join(root, "delta-skill");
    fs.mkdirSync(cwd, { recursive: true });
    const skillFile = path.join(cwd, "SKILL.md");
    fs.writeFileSync(skillFile, "existing");

    const exitCode = runInitCommand([], {
      cwd,
      yes: true,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.readFileSync(skillFile, "utf8")).toContain("name: delta-skill");
  });

  test("rejects invalid skill names", () => {
    const root = makeTempDir("skillet-init-");
    const cwd = root;

    const errors: string[] = [];
    const exitCode = runInitCommand(["InvalidName"], {
      cwd,
      yes: false,
      stdout: () => undefined,
      stderr: (line) => errors.push(line),
    });

    expect(exitCode).toBe(1);
    expect(errors.join("\n")).toContain("must be lowercase");
  });
});
