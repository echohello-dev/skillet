import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  parseApmManifest,
  readApmManifest,
  writeApmManifest,
  apmTargetsToAgents,
  addDependencyToManifest,
  ApmManifestError,
} from "../../src/manifest/apm";

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

describe("parseApmManifest", () => {
  test("parses minimal valid manifest", () => {
    const manifest = parseApmManifest(`name: my-project\nversion: 1.0.0`);
    expect(manifest.name).toBe("my-project");
    expect(manifest.version).toBe("1.0.0");
    expect(manifest.dependencies).toEqual([]);
    expect(manifest.targets).toBeUndefined();
  });

  test("parses manifest with description and targets", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
description: A test project
target: claude
`);
    expect(manifest.description).toBe("A test project");
    expect(manifest.targets).toEqual(["claude"]);
  });

  test("parses array targets", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
targets:
  - claude
  - codex
`);
    expect(manifest.targets).toEqual(["claude", "codex"]);
  });

  test("parses string dependencies", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
dependencies:
  apm:
    - owner/repo
    - owner/repo#v1.0.0
    - https://github.com/owner/repo.git
    - ./local-skills
`);
    expect(manifest.dependencies).toHaveLength(4);
    expect(manifest.dependencies[0].source).toBe("owner/repo");
    expect(manifest.dependencies[1].source).toBe("owner/repo#v1.0.0");
    expect(manifest.dependencies[2].source).toBe("https://github.com/owner/repo.git");
    expect(manifest.dependencies[3].source).toBe("./local-skills");
  });

  test("parses object dependencies with git and ref", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
dependencies:
  apm:
    - git: https://github.com/owner/repo.git
      ref: v1.0.0
`);
    expect(manifest.dependencies).toHaveLength(1);
    expect(manifest.dependencies[0].source).toBe("https://github.com/owner/repo.git#v1.0.0");
  });

  test("parses object dependencies with git, ref, and path", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
dependencies:
  apm:
    - git: https://github.com/owner/repo.git
      ref: main
      path: skills/frontend
`);
    expect(manifest.dependencies[0].source).toBe("https://github.com/owner/repo.git#main:skills/frontend");
  });

  test("parses object dependencies with path only (local)", () => {
    const manifest = parseApmManifest(`
name: my-project
version: 1.0.0
dependencies:
  apm:
    - path: ./my-skills
`);
    expect(manifest.dependencies[0].source).toBe("./my-skills");
  });

  test("throws on missing name", () => {
    expect(() => parseApmManifest("version: 1.0.0")).toThrow(ApmManifestError);
  });

  test("throws on missing version", () => {
    expect(() => parseApmManifest("name: my-project")).toThrow(ApmManifestError);
  });

  test("throws on invalid YAML", () => {
    expect(() => parseApmManifest("{[")).toThrow(ApmManifestError);
  });

  test("throws on non-object root", () => {
    expect(() => parseApmManifest("- item")).toThrow(ApmManifestError);
  });

  test("throws on invalid target type", () => {
    expect(() =>
      parseApmManifest(`
name: my-project
version: 1.0.0
target: 123
`)
    ).toThrow(ApmManifestError);
  });

  test("throws on dependency object without git or path", () => {
    expect(() =>
      parseApmManifest(`
name: my-project
version: 1.0.0
dependencies:
  apm:
    - alias: foo
`)
    ).toThrow(ApmManifestError);
  });
});

describe("readApmManifest", () => {
  test("returns null when file does not exist", () => {
    const dir = makeTempDir("skillet-manifest-");
    expect(readApmManifest(dir)).toBeNull();
  });

  test("reads and parses existing apm.yml", () => {
    const dir = makeTempDir("skillet-manifest-");
    fs.writeFileSync(path.join(dir, "apm.yml"), "name: test\nversion: 0.1.0");
    const manifest = readApmManifest(dir);
    expect(manifest).not.toBeNull();
    expect(manifest!.name).toBe("test");
  });
});

describe("writeApmManifest", () => {
  test("round-trips manifest to disk", () => {
    const dir = makeTempDir("skillet-manifest-");
    const manifest = {
      name: "test",
      version: "1.0.0",
      description: "A test project",
      targets: ["claude"],
      dependencies: [{ source: "owner/repo", raw: "owner/repo" }],
    };
    writeApmManifest(dir, manifest);

    const content = fs.readFileSync(path.join(dir, "apm.yml"), "utf8");
    expect(content).toContain("name: test");
    expect(content).toContain("version: 1.0.0");
    expect(content).toContain("description: A test project");
    expect(content).toContain("- owner/repo");
  });
});

describe("apmTargetsToAgents", () => {
  test("returns undefined for empty targets", () => {
    expect(apmTargetsToAgents([])).toBeUndefined();
    expect(apmTargetsToAgents(undefined)).toBeUndefined();
  });

  test("maps known targets to agents", () => {
    expect(apmTargetsToAgents(["claude", "codex"])).toEqual(["claude", "codex"]);
  });

  test("'all' expands to all known agents", () => {
    expect(apmTargetsToAgents(["all"])).toEqual(["claude", "codex", "opencode", "cursor", "windsurf"]);
  });

  test("'minimal' returns undefined (auto-detect)", () => {
    expect(apmTargetsToAgents(["minimal"])).toBeUndefined();
  });

  test("silently ignores unsupported targets", () => {
    expect(apmTargetsToAgents(["claude", "gemini", "copilot"])).toEqual(["claude"]);
  });
});

describe("addDependencyToManifest", () => {
  test("adds new dependency", () => {
    const manifest = {
      name: "test",
      version: "1.0.0",
      dependencies: [{ source: "owner/a", raw: "owner/a" }],
    };
    const added = addDependencyToManifest(manifest, "owner/b");
    expect(added).toBe(true);
    expect(manifest.dependencies).toHaveLength(2);
  });

  test("skips duplicate dependency", () => {
    const manifest = {
      name: "test",
      version: "1.0.0",
      dependencies: [{ source: "owner/a", raw: "owner/a" }],
    };
    const added = addDependencyToManifest(manifest, "owner/a");
    expect(added).toBe(false);
    expect(manifest.dependencies).toHaveLength(1);
  });
});
