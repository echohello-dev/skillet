import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { runAddCommand } from "../../src/commands/add";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSourceRepo(root: string): string {
  const source = path.join(root, "source");
  const alpha = path.join(source, "skills", "alpha");
  const beta = path.join(source, "skills", "beta");

  fs.mkdirSync(alpha, { recursive: true });
  fs.mkdirSync(beta, { recursive: true });

  fs.writeFileSync(
    path.join(alpha, "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha skill\n---\n\n# Alpha\n"
  );
  fs.writeFileSync(path.join(alpha, "notes.txt"), "alpha");

  fs.writeFileSync(
    path.join(beta, "SKILL.md"),
    "---\nname: beta\ndescription: Beta skill\n---\n\n# Beta\n"
  );
  fs.writeFileSync(path.join(beta, "notes.txt"), "beta");

  return source;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("runAddCommand", () => {
  test("add --list prints available skills without installing", async () => {
    const root = makeTempDir("skillet-add-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const source = createSourceRepo(root);
    const lines: string[] = [];

    const exitCode = await runAddCommand([source, "--list"], {
      cwd,
      homeDir,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines.join("\n")).toContain("alpha");
    expect(lines.join("\n")).toContain("beta");
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha"))).toBe(false);
  });

  test("add --skill installs only selected skills and updates lockfile", async () => {
    const root = makeTempDir("skillet-add-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(path.join(cwd, ".codex", "skills"), { recursive: true });

    const source = createSourceRepo(root);

    const exitCode = await runAddCommand([source, "--skill", "alpha", "--agent", "codex"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "beta", "SKILL.md"))).toBe(false);

    const lockPath = path.join(cwd, "skillet.lock.yaml");
    expect(fs.existsSync(lockPath)).toBe(true);
    const lock = parseYaml(fs.readFileSync(lockPath, "utf8")) as {
      sources: Array<{ skills: string[] }>;
    };
    expect(lock.sources[0]?.skills).toEqual(["alpha"]);
  });

  test("add --all with -y installs all skills without prompts", async () => {
    const root = makeTempDir("skillet-add-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const source = createSourceRepo(root);

    const exitCode = await runAddCommand([source, "--all", "-y", "--agent", "codex"], {
      cwd,
      homeDir,
      promptSelectAgents: () => {
        throw new Error("should not prompt agents");
      },
      promptSelectSkills: () => {
        throw new Error("should not prompt skills");
      },
      promptSelectInstallMethod: () => {
        throw new Error("should not prompt install method");
      },
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "beta", "SKILL.md"))).toBe(true);
  });

  test("prompts for skills, agents, and install method when inputs are missing", async () => {
    const root = makeTempDir("skillet-add-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const source = createSourceRepo(root);

    const exitCode = await runAddCommand([source], {
      cwd,
      homeDir,
      promptSelectSkills: (available) => {
        expect(available).toEqual(["alpha", "beta"]);
        return ["beta"];
      },
      promptSelectAgents: (available) => {
        expect(available).toContain("codex");
        return ["codex"];
      },
      promptSelectInstallMethod: () => "copy",
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    const installedPath = path.join(cwd, ".codex", "skills", "beta");
    expect(fs.existsSync(path.join(installedPath, "SKILL.md"))).toBe(true);
    expect(fs.lstatSync(installedPath).isDirectory()).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha", "SKILL.md"))).toBe(false);
  });
});
