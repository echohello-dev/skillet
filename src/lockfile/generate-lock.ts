import fs from "node:fs";
import path from "node:path";
import { stringify as toYaml } from "yaml";
import { parseSkillMarkdown } from "../skills/skill";

export const SOURCE_METADATA_FILENAME = ".skillet-source.json";

export type GenerateLockfileOptions = {
  scope: "project" | "global";
  cwd?: string;
  homeDir?: string;
};

export type LockfileSource = {
  type: string;
  url: string;
  ref?: string;
  digest?: string;
  installMethod: string;
  skills: string[];
  agents: string[];
};

export type LockfileDocument = {
  version: 1;
  sources: LockfileSource[];
};

export type GenerateLockfileResult = {
  outputPath: string;
  yaml: string;
  lockfile: LockfileDocument;
};

const AGENT_SKILL_DIRS = [
  { agent: "claude", relativePath: ".claude/skills" },
  { agent: "codex", relativePath: ".codex/skills" },
  { agent: "opencode", relativePath: ".opencode/skills" },
  { agent: "cursor", relativePath: ".cursor/skills" },
  { agent: "windsurf", relativePath: ".windsurf/skills" },
] as const;

export function generateLockfile(options: GenerateLockfileOptions): GenerateLockfileResult {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? cwd);

  const scanRoot = options.scope === "project" ? cwd : homeDir;
  const outputPath =
    options.scope === "project"
      ? path.join(cwd, "skillet.lock.yaml")
      : path.join(homeDir, ".skillet", "skillet.lock.yaml");

  const groupedSources = new Map<
    string,
    {
      source: Omit<LockfileSource, "skills" | "agents">;
      skills: Set<string>;
      agents: Set<string>;
    }
  >();

  for (const config of AGENT_SKILL_DIRS) {
    const agentSkillsDir = path.join(scanRoot, config.relativePath);
    if (!isDirectory(agentSkillsDir)) {
      continue;
    }

    for (const skillDir of listSkillDirectories(agentSkillsDir)) {
      const skillFile = path.join(skillDir, "SKILL.md");
      if (!isFile(skillFile)) {
        continue;
      }

      let skillName: string;
      try {
        skillName = parseSkillMarkdown(fs.readFileSync(skillFile, "utf8"), { path: skillFile }).frontmatter.name;
      } catch {
        continue;
      }

      const metadata = readSourceMetadata(skillDir);
      const installMethod =
        metadata.installMethod ?? (fs.lstatSync(skillDir).isSymbolicLink() ? "symlink" : "copy");
      const source = {
        type: metadata.type ?? "unknown",
        url: metadata.url ?? `file://${skillDir}`,
        ref: metadata.ref,
        digest: metadata.digest,
        installMethod,
      };

      const key = [source.type, source.url, source.ref ?? "", source.digest ?? "", source.installMethod].join("|");
      const grouped = groupedSources.get(key) ?? {
        source,
        skills: new Set<string>(),
        agents: new Set<string>(),
      };

      grouped.skills.add(skillName);
      grouped.agents.add(config.agent);
      groupedSources.set(key, grouped);
    }
  }

  const sources: LockfileSource[] = [...groupedSources.values()]
    .map(({ source, skills, agents }) => {
      const normalized: LockfileSource = {
        type: source.type,
        url: source.url,
        installMethod: source.installMethod,
        skills: [...skills].sort((a, b) => a.localeCompare(b)),
        agents: [...agents].sort((a, b) => a.localeCompare(b)),
      };

      if (source.ref) {
        normalized.ref = source.ref;
      }
      if (source.digest) {
        normalized.digest = source.digest;
      }

      return normalized;
    })
    .sort((left, right) => {
      const sortKeys: Array<keyof LockfileSource> = ["type", "url", "ref", "digest", "installMethod"];
      for (const key of sortKeys) {
        const leftValue = left[key] ?? "";
        const rightValue = right[key] ?? "";
        const compare = String(leftValue).localeCompare(String(rightValue));
        if (compare !== 0) {
          return compare;
        }
      }
      return 0;
    });

  const lockfile: LockfileDocument = {
    version: 1,
    sources,
  };

  const yaml = toYaml(lockfile);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, yaml);

  return {
    outputPath,
    yaml,
    lockfile,
  };
}

type SourceMetadata = {
  type?: string;
  url?: string;
  ref?: string;
  digest?: string;
  installMethod?: string;
};

function readSourceMetadata(skillDir: string): SourceMetadata {
  const metadataPath = path.join(skillDir, SOURCE_METADATA_FILENAME);
  if (!isFile(metadataPath)) {
    return {};
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(metadataPath, "utf8")) as Record<string, unknown>;
    return {
      type: readOptionalString(parsed.type),
      url: readOptionalString(parsed.url),
      ref: readOptionalString(parsed.ref),
      digest: readOptionalString(parsed.digest),
      installMethod: readOptionalString(parsed.installMethod),
    };
  } catch {
    return {};
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  return value;
}

function listSkillDirectories(agentSkillsDir: string): string[] {
  const directories: string[] = [];
  for (const entry of fs.readdirSync(agentSkillsDir, { withFileTypes: true })) {
    const candidate = path.join(agentSkillsDir, entry.name);
    if (entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(candidate))) {
      directories.push(candidate);
    }
  }

  return directories.sort((a, b) => a.localeCompare(b));
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
