import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runFindCommand } from "../../src/commands/find";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSkill(baseDir: string, relativeDir: string, name: string, description: string): void {
  const skillDir = path.join(baseDir, relativeDir, name);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n`
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("runFindCommand", () => {
  test("searches by name and description case-insensitively", () => {
    const cwd = makeTempDir("skillet-find-");
    const homeDir = path.join(cwd, "home");

    createSkill(cwd, ".codex/skills", "alpha", "Alpha deployment workflows");
    createSkill(cwd, ".codex/skills", "gamma", "Utilities for alpha teams");
    createSkill(cwd, ".codex/skills", "beta", "Database migrations");

    const lines: string[] = [];
    const exitCode = runFindCommand(["ALPHA"], {
      cwd,
      homeDir,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines[0]).toContain("alpha");
    expect(lines.join("\n")).toContain("gamma");
    expect(lines.join("\n")).not.toContain("beta");
  });

  test("lists all discovered skills when query is omitted", () => {
    const cwd = makeTempDir("skillet-find-");
    const homeDir = path.join(cwd, "home");

    createSkill(cwd, ".codex/skills", "zeta", "Zeta skill");
    createSkill(cwd, ".codex/skills", "alpha", "Alpha skill");

    const lines: string[] = [];
    const exitCode = runFindCommand([], {
      cwd,
      homeDir,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines[0]).toContain("alpha");
    expect(lines[1]).toContain("zeta");
  });

  test("returns zero with clear message when no results match", () => {
    const cwd = makeTempDir("skillet-find-");
    const homeDir = path.join(cwd, "home");
    createSkill(cwd, ".codex/skills", "alpha", "Alpha skill");

    const lines: string[] = [];
    const exitCode = runFindCommand(["nomatch"], {
      cwd,
      homeDir,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines[0]).toBe('No skills found for "nomatch".');
  });

  test("surfaces invalid skill warnings in verbose mode", () => {
    const cwd = makeTempDir("skillet-find-");
    const homeDir = path.join(cwd, "home");

    createSkill(cwd, ".codex/skills", "alpha", "Alpha skill");
    const invalidDir = path.join(cwd, ".codex/skills", "broken");
    fs.mkdirSync(invalidDir, { recursive: true });
    fs.writeFileSync(path.join(invalidDir, "SKILL.md"), "not valid");

    const stderr: string[] = [];
    runFindCommand([], {
      cwd,
      homeDir,
      verbose: true,
      stdout: () => undefined,
      stderr: (line) => stderr.push(line),
    });

    expect(stderr.join("\n")).toContain("Warning:");
    expect(stderr.join("\n")).toContain("broken/SKILL.md");
  });
});
