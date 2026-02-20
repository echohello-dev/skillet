import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  AgentDetectionError,
  detectInstalledAgents,
  getAgentPathMap,
  resolveTargetAgents,
} from "../../src/agents/detection";

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

describe("agent detection", () => {
  test("returns project and global path mapping", () => {
    const cwd = makeTempDir("skillet-agents-");
    const homeDir = makeTempDir("skillet-agents-home-");

    const map = getAgentPathMap({ cwd, homeDir });

    expect(map.codex.project).toBe(path.join(cwd, ".codex", "skills"));
    expect(map.codex.global).toBe(path.join(homeDir, ".codex", "skills"));
    expect(map.claude.project).toBe(path.join(cwd, ".claude", "skills"));
  });

  test("detects installed agents from existing directories", () => {
    const cwd = makeTempDir("skillet-agents-");
    const homeDir = makeTempDir("skillet-agents-home-");

    fs.mkdirSync(path.join(cwd, ".codex", "skills"), { recursive: true });
    fs.mkdirSync(path.join(homeDir, ".claude", "skills"), { recursive: true });

    const detected = detectInstalledAgents({ cwd, homeDir });

    expect(detected.map((item) => item.agent)).toEqual(["claude", "codex"]);
  });

  test("uses explicit agents without prompting", () => {
    const cwd = makeTempDir("skillet-agents-");
    const homeDir = makeTempDir("skillet-agents-home-");

    const resolved = resolveTargetAgents({
      cwd,
      homeDir,
      explicitAgents: ["codex", "claude", "codex"],
      promptWhenNone: () => {
        throw new Error("prompt should not be called");
      },
    });

    expect(resolved).toEqual(["claude", "codex"]);
  });

  test("prompts when no agents are detected and none are specified", () => {
    const cwd = makeTempDir("skillet-agents-");
    const homeDir = makeTempDir("skillet-agents-home-");

    const resolved = resolveTargetAgents({
      cwd,
      homeDir,
      promptWhenNone: (available) => {
        expect(available).toContain("codex");
        return ["codex"];
      },
    });

    expect(resolved).toEqual(["codex"]);
  });

  test("throws when no agents detected and prompt is unavailable", () => {
    const cwd = makeTempDir("skillet-agents-");
    const homeDir = makeTempDir("skillet-agents-home-");

    expect(() =>
      resolveTargetAgents({
        cwd,
        homeDir,
      })
    ).toThrowError(AgentDetectionError);
  });
});
