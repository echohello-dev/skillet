import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { runAddCommand } from "../../src/commands/add";
import { runCheckCommand } from "../../src/commands/check";
import { runUpdateCommand } from "../../src/commands/update";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createSkillRepo(root: string): string {
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo, { recursive: true });
  runGit(["init", "-b", "main"], repo);
  runGit(["config", "user.email", "test@example.com"], repo);
  runGit(["config", "user.name", "Test User"], repo);

  const skillDir = path.join(repo, "skills", "alpha");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha skill\n---\n\n# Alpha\n"
  );
  fs.writeFileSync(path.join(skillDir, "content.txt"), "v1\n");

  runGit(["add", "."], repo);
  runGit(["commit", "-m", "initial"], repo);
  return repo;
}

function advanceSkillRepo(repo: string): void {
  fs.writeFileSync(path.join(repo, "skills", "alpha", "content.txt"), "v2\n");
  runGit(["add", "."], repo);
  runGit(["commit", "-m", "update"], repo);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("check + update commands", () => {
  test("check distinguishes up-to-date vs outdated skills", async () => {
    const root = makeTempDir("skillet-check-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const repo = createSkillRepo(root);

    const addExit = await runAddCommand([`${repo}#main`, "--agent", "codex", "-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(addExit).toBe(0);

    const firstOutput: string[] = [];
    const firstExit = await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => firstOutput.push(line),
      stderr: () => undefined,
    });

    expect(firstExit).toBe(0);
    expect(firstOutput.join("\n")).toContain("up-to-date");

    advanceSkillRepo(repo);

    const secondOutput: string[] = [];
    const secondExit = await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => secondOutput.push(line),
      stderr: () => undefined,
    });

    expect(secondExit).toBe(0);
    expect(secondOutput.join("\n")).toContain("outdated");
  });

  test("update refreshes outdated skills and updates lockfile digest", async () => {
    const root = makeTempDir("skillet-update-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const repo = createSkillRepo(root);

    await runAddCommand([`${repo}#main`, "--agent", "codex", "-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    const lockPath = path.join(cwd, "skillet.lock.yaml");
    const beforeLock = parseYaml(fs.readFileSync(lockPath, "utf8")) as {
      sources: Array<{ digest?: string }>;
    };
    const beforeDigest = beforeLock.sources[0]?.digest;

    advanceSkillRepo(repo);

    const updateOutput: string[] = [];
    const updateExit = await runUpdateCommand(["-y"], {
      cwd,
      homeDir,
      stdout: (line) => updateOutput.push(line),
      stderr: () => undefined,
    });

    expect(updateExit).toBe(0);
    expect(updateOutput.join("\n")).toContain("updated");

    const afterLock = parseYaml(fs.readFileSync(lockPath, "utf8")) as {
      sources: Array<{ digest?: string }>;
    };
    const afterDigest = afterLock.sources[0]?.digest;

    expect(afterDigest).toBeDefined();
    expect(afterDigest).not.toBe(beforeDigest);

    const installedContent = fs.readFileSync(
      path.join(cwd, ".codex", "skills", "alpha", "content.txt"),
      "utf8"
    );
    expect(installedContent).toBe("v2\n");
  });
});
