import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import { InstallConflictError, installSkill } from "../../src/install/installer";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createSkillSource(rootDir: string, skillName: string, body = "content"): string {
  const skillDir = path.join(rootDir, skillName);
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(path.join(skillDir, "SKILL.md"), `---\nname: ${skillName}\ndescription: ${skillName}\n---\n\n# ${skillName}\n`);
  fs.writeFileSync(path.join(skillDir, "notes.txt"), body);
  return skillDir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("installSkill", () => {
  test("installs via symlink by default", () => {
    const temp = makeTempDir("skillet-installer-");
    const sourceSkillPath = createSkillSource(path.join(temp, "source"), "alpha");

    const result = installSkill({
      sourceId: "github.com/org/repo",
      sourceSkillPath,
      storageRoot: path.join(temp, "storage"),
      targetSkillsDir: path.join(temp, "target-skills"),
    });

    expect(result.method).toBe("symlink");
    expect(result.skillName).toBe("alpha");
    expect(fs.lstatSync(result.installedPath).isSymbolicLink()).toBe(true);
    expect(fs.existsSync(path.join(result.storagePath, "SKILL.md"))).toBe(true);
    expect(fs.readFileSync(path.join(result.installedPath, "notes.txt"), "utf8")).toBe("content");
  });

  test("falls back to copy when symlink creation fails", () => {
    const temp = makeTempDir("skillet-installer-");
    const sourceSkillPath = createSkillSource(path.join(temp, "source"), "beta");

    const result = installSkill({
      sourceId: "github.com/org/repo",
      sourceSkillPath,
      storageRoot: path.join(temp, "storage"),
      targetSkillsDir: path.join(temp, "target-skills"),
      symlinkFn: () => {
        const error = new Error("symlink not permitted") as NodeJS.ErrnoException;
        error.code = "EPERM";
        throw error;
      },
    });

    expect(result.method).toBe("copy");
    expect(fs.lstatSync(result.installedPath).isDirectory()).toBe(true);
    expect(fs.readFileSync(path.join(result.installedPath, "notes.txt"), "utf8")).toBe("content");
  });

  test("updates existing installation atomically", () => {
    const temp = makeTempDir("skillet-installer-");
    const sourceSkillPath = createSkillSource(path.join(temp, "source"), "gamma", "first");
    const options = {
      sourceId: "github.com/org/repo",
      sourceSkillPath,
      storageRoot: path.join(temp, "storage"),
      targetSkillsDir: path.join(temp, "target-skills"),
    };

    const first = installSkill(options);
    fs.writeFileSync(path.join(sourceSkillPath, "notes.txt"), "second");
    const second = installSkill(options);

    expect(second.storagePath).toBe(first.storagePath);
    expect(second.changed).toBe(true);
    expect(fs.readFileSync(path.join(second.installedPath, "notes.txt"), "utf8")).toBe("second");
  });

  test("throws clear conflict error for non-directory install path", () => {
    const temp = makeTempDir("skillet-installer-");
    const sourceSkillPath = createSkillSource(path.join(temp, "source"), "delta");
    const targetSkillsDir = path.join(temp, "target-skills");

    fs.mkdirSync(targetSkillsDir, { recursive: true });
    fs.writeFileSync(path.join(targetSkillsDir, "delta"), "blocking file");

    expect(() =>
      installSkill({
        sourceId: "github.com/org/repo",
        sourceSkillPath,
        storageRoot: path.join(temp, "storage"),
        targetSkillsDir,
      })
    ).toThrowError(InstallConflictError);
  });
});
