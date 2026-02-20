import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { generateLockfile } from "../../src/lockfile/generate-lock";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createInstalledSkill(
  rootDir: string,
  agentDir: string,
  skillName: string,
  metadata: Record<string, string>
): void {
  const skillDir = path.join(rootDir, agentDir, skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${skillName}\ndescription: ${skillName}\n---\n\n# ${skillName}\n`
  );
  fs.writeFileSync(path.join(skillDir, ".skillet-source.json"), JSON.stringify(metadata, null, 2));
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("generateLockfile", () => {
  test("generates deterministic project-scope lockfile", () => {
    const cwd = makeTempDir("skillet-lock-project-");
    const homeDir = path.join(cwd, "home");

    createInstalledSkill(cwd, ".codex/skills", "alpha", {
      type: "git",
      url: "https://github.com/echohello-dev/skills.git",
      ref: "main",
      installMethod: "symlink",
    });

    createInstalledSkill(cwd, ".claude/skills", "beta", {
      type: "oci",
      url: "oci://ghcr.io/echohello/skills",
      digest: "sha256:abc123",
      installMethod: "copy",
    });

    const first = generateLockfile({ scope: "project", cwd, homeDir });
    const second = generateLockfile({ scope: "project", cwd, homeDir });

    expect(first.outputPath).toBe(path.join(cwd, "skillet.lock.yaml"));
    expect(first.yaml).toBe(second.yaml);

    const parsed = parseYaml(first.yaml) as {
      version: number;
      sources: Array<{ type: string; skills: string[]; agents: string[] }>;
    };

    expect(parsed.version).toBe(1);
    expect(parsed.sources).toHaveLength(2);
    expect(parsed.sources[0]?.type).toBe("git");
    expect(parsed.sources[0]?.skills).toEqual(["alpha"]);
    expect(parsed.sources[0]?.agents).toEqual(["codex"]);
    expect(parsed.sources[1]?.type).toBe("oci");
    expect(parsed.sources[1]?.skills).toEqual(["beta"]);
    expect(parsed.sources[1]?.agents).toEqual(["claude"]);
  });

  test("generates global-scope lockfile in home directory", () => {
    const cwd = makeTempDir("skillet-lock-global-cwd-");
    const homeDir = makeTempDir("skillet-lock-global-home-");

    createInstalledSkill(homeDir, ".codex/skills", "gamma", {
      type: "http",
      url: "https://example.com/archive.tar.gz",
      ref: "v1.0.0",
      installMethod: "copy",
    });

    const result = generateLockfile({ scope: "global", cwd, homeDir });

    expect(result.outputPath).toBe(path.join(homeDir, ".skillet", "skillet.lock.yaml"));
    expect(fs.existsSync(result.outputPath)).toBe(true);

    const parsed = parseYaml(result.yaml) as {
      sources: Array<{ type: string; skills: string[]; agents: string[] }>;
    };

    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0]?.type).toBe("http");
    expect(parsed.sources[0]?.skills).toEqual(["gamma"]);
    expect(parsed.sources[0]?.agents).toEqual(["codex"]);
  });

  test("groups multiple skills from the same source with stable ordering", () => {
    const cwd = makeTempDir("skillet-lock-group-");
    const homeDir = path.join(cwd, "home");

    createInstalledSkill(cwd, ".codex/skills", "zeta", {
      type: "git",
      url: "https://github.com/echohello-dev/skills.git",
      ref: "main",
      installMethod: "symlink",
    });
    createInstalledSkill(cwd, ".codex/skills", "alpha", {
      type: "git",
      url: "https://github.com/echohello-dev/skills.git",
      ref: "main",
      installMethod: "symlink",
    });

    const result = generateLockfile({ scope: "project", cwd, homeDir });
    const parsed = parseYaml(result.yaml) as {
      sources: Array<{ skills: string[]; agents: string[] }>;
    };

    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0]?.skills).toEqual(["alpha", "zeta"]);
    expect(parsed.sources[0]?.agents).toEqual(["codex"]);
  });
});
