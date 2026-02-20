import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { discoverSkills } from "../../src/skills/discovery";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSkill(skillDir: string, name = path.basename(skillDir), description?: string): void {
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    `---\nname: ${name}\ndescription: ${description ?? `${name} description`}\n---\n\n# ${name}\n\nBody\n`
  );
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("discoverSkills", () => {
  test("discovers skills from standard project locations deterministically", () => {
    const cwd = makeTempDir("skillet-discovery-");
    const homeDir = path.join(cwd, "home");

    createSkill(path.join(cwd, "skills", "zeta"));
    createSkill(path.join(cwd, "skills", ".curated", "alpha"));

    const result = discoverSkills({ cwd, homeDir });

    expect(result.skills.map((skill) => skill.name)).toEqual(["alpha", "zeta"]);
    expect(result.usedFallback).toBe(false);
  });

  test("discovers skills in known agent directories", () => {
    const cwd = makeTempDir("skillet-discovery-");
    const homeDir = path.join(cwd, "home");

    createSkill(path.join(homeDir, ".codex", "skills", "agent-skill"));

    const result = discoverSkills({ cwd, homeDir });

    expect(result.skills.map((skill) => skill.name)).toContain("agent-skill");
    expect(result.usedFallback).toBe(false);
  });

  test("dedupes duplicate discoveries by canonical path and name", () => {
    const cwd = makeTempDir("skillet-discovery-");
    const homeDir = path.join(cwd, "home");
    const canonicalSkillPath = path.join(cwd, "skills", "dupe");
    createSkill(canonicalSkillPath);

    const agentSkillsDir = path.join(cwd, ".codex", "skills");
    fs.mkdirSync(agentSkillsDir, { recursive: true });
    fs.symlinkSync(canonicalSkillPath, path.join(agentSkillsDir, "dupe-link"), "dir");

    const result = discoverSkills({ cwd, homeDir });

    expect(result.skills.filter((skill) => skill.name === "dupe")).toHaveLength(1);
  });

  test("skips invalid SKILL.md and reports warning only in verbose mode", () => {
    const cwd = makeTempDir("skillet-discovery-");
    const homeDir = path.join(cwd, "home");
    const invalidDir = path.join(cwd, "skills", "broken");

    fs.mkdirSync(invalidDir, { recursive: true });
    fs.writeFileSync(path.join(invalidDir, "SKILL.md"), "# broken");

    const quietResult = discoverSkills({ cwd, homeDir, verbose: false });
    const verboseResult = discoverSkills({ cwd, homeDir, verbose: true });

    expect(quietResult.skills).toHaveLength(0);
    expect(quietResult.warnings).toHaveLength(0);
    expect(verboseResult.warnings).toHaveLength(1);
    expect(verboseResult.warnings[0]?.path).toContain(path.join("skills", "broken", "SKILL.md"));
  });

  test("uses recursive fallback only when standard locations are empty", () => {
    const cwd = makeTempDir("skillet-discovery-");
    const homeDir = path.join(cwd, "home");

    createSkill(path.join(cwd, "custom", "nested", "fallback-skill"));

    const fallbackResult = discoverSkills({ cwd, homeDir });
    expect(fallbackResult.skills.map((skill) => skill.name)).toContain("fallback-skill");
    expect(fallbackResult.usedFallback).toBe(true);

    createSkill(path.join(cwd, "skills", "primary-skill"));

    const noFallbackResult = discoverSkills({ cwd, homeDir });
    expect(noFallbackResult.skills.map((skill) => skill.name)).toContain("primary-skill");
    expect(noFallbackResult.skills.map((skill) => skill.name)).not.toContain("fallback-skill");
    expect(noFallbackResult.usedFallback).toBe(false);
  });
});
