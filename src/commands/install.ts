import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AgentName, resolveTargetAgents } from "../agents/detection";
import { installSkill } from "../install/installer";
import { SOURCE_METADATA_FILENAME, generateLockfile } from "../lockfile/generate-lock";
import {
  readApmManifest,
  apmTargetsToAgents,
  dependencyToSourceString,
} from "../manifest/apm";
import { parseSkillMarkdown } from "../skills/skill";
import { resolveSource, discoverSourceSkills, type SourceSkill } from "./add";

type WriteLine = (line: string) => void;

export type RunInstallCommandOptions = {
  cwd?: string;
  homeDir?: string;
  yes?: boolean;
  verbose?: boolean;
  stdout?: WriteLine;
  stderr?: WriteLine;
  dryRun?: boolean;
};

export async function runInstallCommand(_args: string[], options: RunInstallCommandOptions = {}): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? os.homedir());

  const manifest = readApmManifest(cwd);
  if (!manifest) {
    stderr("No apm.yml found. Run `sklt init` to scaffold a project or create apm.yml manually.");
    return 1;
  }

  if (options.verbose) {
    stdout(`Installing from ${manifest.name}@${manifest.version}`);
  }

  let targetAgents: AgentName[];
  try {
    const manifestTargets = apmTargetsToAgents(manifest.targets);
    if (manifestTargets && manifestTargets.length > 0) {
      targetAgents = manifestTargets;
    } else {
      targetAgents = resolveTargetAgents({ cwd, homeDir });
    }
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (manifest.dependencies.length === 0) {
    stdout("No dependencies to install.");
    return 0;
  }

  if (options.dryRun) {
    stdout("Would install:");
    for (const dep of manifest.dependencies) {
      stdout(`  - ${dependencyToSourceString(dep)}`);
    }
    return 0;
  }

  const storageRoot = path.join(cwd, ".skillet", "storage");
  let anyFailed = false;

  for (const dep of manifest.dependencies) {
    const source = dependencyToSourceString(dep);
    if (options.verbose) {
      stdout(`Resolving ${source}...`);
    }

    let contentPath: string;
    let sourceType: string;
    let sourceUrl: string;
    let sourceRef: string | undefined;
    let sourceDigest: string | undefined;

    try {
      const resolved = await resolveSource(source, {
        tempRoot: path.join(cwd, ".skillet", "tmp"),
      });
      contentPath = resolved.contentPath;
      sourceType = resolved.type;
      sourceUrl = resolved.url;
      sourceRef = resolved.ref;
      sourceDigest = resolved.digest;
    } catch (error) {
      stderr(`Failed to resolve ${source}: ${error instanceof Error ? error.message : String(error)}`);
      anyFailed = true;
      continue;
    }

    const availableSkills = discoverSourceSkills(contentPath);
    if (availableSkills.length === 0) {
      stderr(`No skills discovered in ${source}`);
      continue;
    }

    const sourceMetadata = {
      type: sourceType,
      url: sourceUrl,
      ref: sourceRef,
      digest: sourceDigest,
    };

    for (const agent of targetAgents) {
      const targetSkillsDir = path.join(cwd, getAgentSkillsPath(agent));

      for (const skill of availableSkills) {
        try {
          const installed = installSkill({
            sourceId: `${sourceType}:${sourceUrl}:${sourceRef ?? ""}:${sourceDigest ?? ""}`,
            sourceSkillPath: skill.path,
            storageRoot,
            targetSkillsDir,
            preferCopy: false,
          });

          fs.writeFileSync(
            path.join(installed.installedPath, SOURCE_METADATA_FILENAME),
            JSON.stringify(
              {
                ...sourceMetadata,
                installMethod: installed.method,
              },
              null,
              2
            )
          );

          stdout(`Installed ${skill.name} to ${agent} (${installed.method})`);
        } catch (error) {
          stderr(
            `Failed to install ${skill.name} to ${agent}: ${error instanceof Error ? error.message : String(error)}`
          );
          anyFailed = true;
        }
      }
    }
  }

  const lock = generateLockfile({
    scope: "project",
    cwd,
    homeDir,
  });

  if (options.verbose) {
    stdout(`Updated lockfile: ${lock.outputPath}`);
  }

  return anyFailed ? 1 : 0;
}

function getAgentSkillsPath(agent: AgentName): string {
  switch (agent) {
    case "claude":
      return ".claude/skills";
    case "codex":
      return ".codex/skills";
    case "opencode":
      return ".opencode/skills";
    case "cursor":
      return ".cursor/skills";
    case "windsurf":
      return ".windsurf/skills";
  }
}
