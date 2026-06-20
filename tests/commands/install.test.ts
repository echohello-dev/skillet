import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { runInstallCommand } from "../../src/commands/install";

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
  fs.writeFileSync(
    path.join(beta, "SKILL.md"),
    "---\nname: beta\ndescription: Beta skill\n---\n\n# Beta\n"
  );

  return source;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("runInstallCommand", () => {
  test("returns error when no apm.yml exists", async () => {
    const root = makeTempDir("skillet-install-");
    const lines: string[] = [];

    const exitCode = await runInstallCommand([], {
      cwd: root,
      stdout: () => undefined,
      stderr: (line) => lines.push(line),
    });

    expect(exitCode).toBe(1);
    expect(lines.join("\n")).toContain("No apm.yml found");
  });

  test("returns success when dependencies are empty", async () => {
    const root = makeTempDir("skillet-install-");
    fs.mkdirSync(path.join(root, ".codex", "skills"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "apm.yml"),
      "name: my-project\nversion: 1.0.0\ndependencies:\n  apm: []\n"
    );

    const lines: string[] = [];
    const exitCode = await runInstallCommand([], {
      cwd: root,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines.join("\n")).toContain("No dependencies to install");
  });

  test("dry-run prints plan without installing", async () => {
    const root = makeTempDir("skillet-install-");
    fs.mkdirSync(path.join(root, ".codex", "skills"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "apm.yml"),
      "name: my-project\nversion: 1.0.0\ndependencies:\n  apm:\n    - owner/repo\n"
    );

    const lines: string[] = [];
    const exitCode = await runInstallCommand([], {
      cwd: root,
      dryRun: true,
      stdout: (line) => lines.push(line),
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(lines.join("\n")).toContain("Would install:");
    expect(lines.join("\n")).toContain("owner/repo");
    expect(fs.existsSync(path.join(root, ".claude"))).toBe(false);
  });

  test("installs skills from local source into detected agent dir", async () => {
    const root = makeTempDir("skillet-install-");
    const cwd = path.join(root, "workspace");
    fs.mkdirSync(cwd, { recursive: true });

    // Create agent marker for codex so it's auto-detected
    fs.mkdirSync(path.join(cwd, ".codex", "skills"), { recursive: true });

    const source = createSourceRepo(root);

    fs.writeFileSync(
      path.join(cwd, "apm.yml"),
      `name: my-project\nversion: 1.0.0\ndependencies:\n  apm:\n    - ${source}\n`
    );

    const exitCode = await runInstallCommand([], {
      cwd,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "beta", "SKILL.md"))).toBe(true);
  });

  test("installs skills into manifest-declared targets", async () => {
    const root = makeTempDir("skillet-install-");
    const cwd = path.join(root, "workspace");
    fs.mkdirSync(cwd, { recursive: true });

    const source = createSourceRepo(root);

    fs.writeFileSync(
      path.join(cwd, "apm.yml"),
      `name: my-project\nversion: 1.0.0\ntarget: cursor\ndependencies:\n  apm:\n    - ${source}\n`
    );

    const exitCode = await runInstallCommand([], {
      cwd,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, ".cursor", "skills", "alpha", "SKILL.md"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, ".codex", "skills"))).toBe(false);
  });

  test("continues installing after a failed resolution", async () => {
    const root = makeTempDir("skillet-install-");
    const cwd = path.join(root, "workspace");
    fs.mkdirSync(cwd, { recursive: true });
    fs.mkdirSync(path.join(cwd, ".codex", "skills"), { recursive: true });

    const source = createSourceRepo(root);

    fs.writeFileSync(
      path.join(cwd, "apm.yml"),
      `name: my-project\nversion: 1.0.0\ndependencies:\n  apm:\n    - /nonexistent/path\n    - ${source}\n`
    );

    const stderrLines: string[] = [];
    const exitCode = await runInstallCommand([], {
      cwd,
      stdout: () => undefined,
      stderr: (line) => stderrLines.push(line),
    });

    expect(exitCode).toBe(1);
    expect(stderrLines.join("\n")).toContain("Failed to resolve");
    // The second dependency should still have been installed
    expect(fs.existsSync(path.join(cwd, ".codex", "skills", "alpha", "SKILL.md"))).toBe(true);
  });

  test("generates lockfile after install", async () => {
    const root = makeTempDir("skillet-install-");
    const cwd = path.join(root, "workspace");
    fs.mkdirSync(cwd, { recursive: true });
    fs.mkdirSync(path.join(cwd, ".codex", "skills"), { recursive: true });

    const source = createSourceRepo(root);

    fs.writeFileSync(
      path.join(cwd, "apm.yml"),
      `name: my-project\nversion: 1.0.0\ndependencies:\n  apm:\n    - ${source}\n`
    );

    const exitCode = await runInstallCommand([], {
      cwd,
      stdout: () => undefined,
      stderr: () => undefined,
    });

    expect(exitCode).toBe(0);
    expect(fs.existsSync(path.join(cwd, "skillet.lock.yaml"))).toBe(true);
  });
});
