import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, test } from "vitest";
import { GitSourceError, parseGitSource, resolveGitSource } from "../../src/resolvers/git";

const tempDirs: string[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createFixtureRepo(root: string): { repoPath: string; mainSha: string; featureSha: string } {
  const repoPath = path.join(root, "fixture-repo");
  fs.mkdirSync(repoPath, { recursive: true });
  runGit(["init", "-b", "main"], repoPath);
  runGit(["config", "user.email", "test@example.com"], repoPath);
  runGit(["config", "user.name", "Skillet Test"], repoPath);

  fs.mkdirSync(path.join(repoPath, "skills", "alpha"), { recursive: true });
  fs.writeFileSync(
    path.join(repoPath, "skills", "alpha", "SKILL.md"),
    "---\nname: alpha\ndescription: alpha\n---\n\n# alpha\n"
  );
  runGit(["add", "."], repoPath);
  runGit(["commit", "-m", "main"], repoPath);
  const mainSha = runGit(["rev-parse", "HEAD"], repoPath);

  runGit(["checkout", "-b", "feature"], repoPath);
  fs.writeFileSync(path.join(repoPath, "feature.txt"), "feature branch\n");
  runGit(["add", "."], repoPath);
  runGit(["commit", "-m", "feature"], repoPath);
  const featureSha = runGit(["rev-parse", "HEAD"], repoPath);

  runGit(["checkout", "main"], repoPath);

  return { repoPath, mainSha, featureSha };
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("parseGitSource", () => {
  test("parses owner/repo shorthand", () => {
    const parsed = parseGitSource("echohello-dev/skillet");

    expect(parsed.cloneUrl).toBe("https://github.com/echohello-dev/skillet.git");
    expect(parsed.ref).toBeUndefined();
    expect(parsed.subdirectory).toBeUndefined();
  });

  test("parses tree URL with ref and subdirectory", () => {
    const parsed = parseGitSource("https://github.com/acme/tools/tree/main/skills/foo");

    expect(parsed.cloneUrl).toBe("https://github.com/acme/tools.git");
    expect(parsed.ref).toBe("main");
    expect(parsed.subdirectory).toBe("skills/foo");
  });

  test("parses git@ source with explicit ref", () => {
    const parsed = parseGitSource("git@github.com:acme/tools.git#v1.2.3");

    expect(parsed.cloneUrl).toBe("git@github.com:acme/tools.git");
    expect(parsed.ref).toBe("v1.2.3");
  });
});

describe("resolveGitSource", () => {
  test("resolves local repository and captures commit SHA", () => {
    const temp = makeTempDir("skillet-git-");
    const { repoPath, mainSha } = createFixtureRepo(temp);

    const resolved = resolveGitSource(repoPath, { tempRoot: path.join(temp, "clones") });

    expect(resolved.commitSha).toBe(mainSha);
    expect(fs.existsSync(path.join(resolved.checkoutPath, "skills", "alpha", "SKILL.md"))).toBe(true);
  });

  test("resolves optional ref and subdirectory", () => {
    const temp = makeTempDir("skillet-git-");
    const { repoPath } = createFixtureRepo(temp);

    const resolved = resolveGitSource(`${repoPath}#main:skills/alpha`, {
      tempRoot: path.join(temp, "clones"),
    });

    expect(path.basename(resolved.contentPath)).toBe("alpha");
    expect(fs.existsSync(path.join(resolved.contentPath, "SKILL.md"))).toBe(true);
  });

  test("throws clear error for missing repository", () => {
    const temp = makeTempDir("skillet-git-");

    expect(() => resolveGitSource(path.join(temp, "missing"))).toThrowError(GitSourceError);
  });
});
