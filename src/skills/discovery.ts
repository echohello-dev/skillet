import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseSkillMarkdown, SkillParseError } from "./skill";

export type DiscoveryWarning = {
  path: string;
  message: string;
  field?: string;
};

export type DiscoveredSkill = {
  name: string;
  description: string;
  path: string;
  source: "standard" | "agent" | "fallback";
};

export type DiscoverSkillsOptions = {
  cwd?: string;
  homeDir?: string;
  verbose?: boolean;
};

export type DiscoverSkillsResult = {
  skills: DiscoveredSkill[];
  warnings: DiscoveryWarning[];
  usedFallback: boolean;
};

const STANDARD_SKILL_DIRS = [
  ".",
  "skills",
  "skills/.curated",
  "skills/.experimental",
  "skills/.system",
] as const;

const KNOWN_AGENT_SKILL_DIRS = [
  ".claude/skills",
  ".codex/skills",
  ".opencode/skills",
  ".cursor/skills",
  ".windsurf/skills",
] as const;

const FALLBACK_IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  ".worktrees",
  "worktrees",
]);

export function discoverSkills(options: DiscoverSkillsOptions = {}): DiscoverSkillsResult {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? os.homedir());
  const warnings: DiscoveryWarning[] = [];
  const skills: DiscoveredSkill[] = [];
  const seenCanonicalPaths = new Set<string>();
  const seenNames = new Set<string>();

  const standardRoots = STANDARD_SKILL_DIRS
    .map((relativePath) => path.resolve(cwd, relativePath))
    .filter(isDirectory)
    .sort((a, b) => a.localeCompare(b));

  let standardSkillCount = 0;
  let standardCandidateCount = 0;
  for (const root of standardRoots) {
    const result = collectFromRoot({
      root,
      source: "standard",
      verbose: options.verbose === true,
      skills,
      warnings,
      seenCanonicalPaths,
      seenNames,
    });
    standardSkillCount += result.discoveredCount;
    standardCandidateCount += result.candidateCount;
  }

  const agentRoots = collectAgentRoots(cwd, homeDir);
  let agentCandidateCount = 0;
  for (const root of agentRoots) {
    const result = collectFromRoot({
      root,
      source: "agent",
      verbose: options.verbose === true,
      skills,
      warnings,
      seenCanonicalPaths,
      seenNames,
    });
    agentCandidateCount += result.candidateCount;
  }

  let usedFallback = false;
  if (standardCandidateCount === 0 && standardSkillCount === 0 && agentCandidateCount === 0) {
    usedFallback = true;

    // Fallback is intentionally broad and only runs when standard locations are empty.
    for (const skillFile of findSkillFilesRecursively(cwd)) {
      const skillDir = path.dirname(skillFile);
      collectFromSkillDir({
        skillDir,
        source: "fallback",
        verbose: options.verbose === true,
        skills,
        warnings,
        seenCanonicalPaths,
        seenNames,
      });
    }
  }

  skills.sort((left, right) => {
    const nameCompare = left.name.localeCompare(right.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    return left.path.localeCompare(right.path);
  });

  return {
    skills,
    warnings,
    usedFallback,
  };
}

type CollectContext = {
  source: DiscoveredSkill["source"];
  verbose: boolean;
  skills: DiscoveredSkill[];
  warnings: DiscoveryWarning[];
  seenCanonicalPaths: Set<string>;
  seenNames: Set<string>;
};

function collectFromRoot(
  context: CollectContext & { root: string }
): { discoveredCount: number; candidateCount: number } {
  const discoveredBefore = context.skills.length;
  let candidateCount = 0;
  const candidateDirs = new Set<string>([context.root, ...listChildDirectories(context.root)]);

  for (const skillDir of [...candidateDirs].sort((a, b) => a.localeCompare(b))) {
    const hasSkillFile = collectFromSkillDir({
      ...context,
      skillDir,
    });
    if (hasSkillFile) {
      candidateCount += 1;
    }
  }

  return {
    discoveredCount: context.skills.length - discoveredBefore,
    candidateCount,
  };
}

function collectFromSkillDir(context: CollectContext & { skillDir: string }): boolean {
  const skillFile = path.join(context.skillDir, "SKILL.md");
  if (!isFile(skillFile)) {
    return false;
  }

  let parsed;
  try {
    parsed = parseSkillMarkdown(fs.readFileSync(skillFile, "utf8"), { path: skillFile });
  } catch (error) {
    if (context.verbose && error instanceof SkillParseError) {
      context.warnings.push({
        path: skillFile,
        message: error.message,
        field: error.field,
      });
    }

    return true;
  }

  const canonicalPath = toCanonicalPath(context.skillDir);
  if (context.seenCanonicalPaths.has(canonicalPath) || context.seenNames.has(parsed.frontmatter.name)) {
    return true;
  }

  context.seenCanonicalPaths.add(canonicalPath);
  context.seenNames.add(parsed.frontmatter.name);
  context.skills.push({
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
    path: context.skillDir,
    source: context.source,
  });

  return true;
}

function collectAgentRoots(cwd: string, homeDir: string): string[] {
  const roots = new Set<string>();

  for (const relativePath of KNOWN_AGENT_SKILL_DIRS) {
    roots.add(path.resolve(cwd, relativePath));
    roots.add(path.resolve(homeDir, relativePath));
  }

  return [...roots].filter(isDirectory).sort((a, b) => a.localeCompare(b));
}

function listChildDirectories(root: string): string[] {
  const directories: string[] = [];

  for (const dirent of fs.readdirSync(root, { withFileTypes: true })) {
    const candidate = path.join(root, dirent.name);
    if (dirent.isDirectory() || (dirent.isSymbolicLink() && isDirectory(candidate))) {
      directories.push(candidate);
    }
  }

  return directories;
}

function findSkillFilesRecursively(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const dirent of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, dirent.name);

      if (dirent.isDirectory()) {
        if (FALLBACK_IGNORED_DIRS.has(dirent.name)) {
          continue;
        }
        stack.push(candidate);
        continue;
      }

      if (dirent.name === "SKILL.md" && isFile(candidate)) {
        files.push(candidate);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function toCanonicalPath(directoryPath: string): string {
  try {
    return fs.realpathSync(directoryPath);
  } catch {
    return path.resolve(directoryPath);
  }
}

function isDirectory(candidatePath: string): boolean {
  try {
    return fs.statSync(candidatePath).isDirectory();
  } catch {
    return false;
  }
}

function isFile(candidatePath: string): boolean {
  try {
    return fs.statSync(candidatePath).isFile();
  } catch {
    return false;
  }
}
