import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { KNOWN_AGENTS, type AgentName, resolveTargetAgents, getAgentPathMap } from "../agents/detection";
import { installSkill, type InstallMethod } from "../install/installer";
import { SOURCE_METADATA_FILENAME, generateLockfile } from "../lockfile/generate-lock";
import { resolveGitSource } from "../resolvers/git";
import { resolveHttpArchive } from "../resolvers/http-archive";
import { resolveOciSource } from "../resolvers/oci";
import { parseSkillMarkdown } from "../skills/skill";

type WriteLine = (line: string) => void;

type PromptSelectSkills = (availableSkills: string[]) => string[];
type PromptSelectAgents = (availableAgents: AgentName[]) => AgentName[];
type PromptSelectInstallMethod = () => InstallMethod;

export type RunAddCommandOptions = {
  cwd?: string;
  homeDir?: string;
  yes?: boolean;
  verbose?: boolean;
  stdout?: WriteLine;
  stderr?: WriteLine;
  promptSelectSkills?: PromptSelectSkills;
  promptSelectAgents?: PromptSelectAgents;
  promptSelectInstallMethod?: PromptSelectInstallMethod;
  insecureHttp?: boolean;
};

export async function runAddCommand(args: string[], options: RunAddCommandOptions = {}): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? os.homedir());

  let parsed: ParsedAddArgs;
  try {
    parsed = parseAddArgs(args);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (options.yes) {
    parsed.yes = true;
  }

  if (!parsed.source) {
    stderr("Usage: skillet add <source> [options]");
    return 1;
  }

  let resolved: ResolvedSource;
  try {
    resolved = await resolveSource(parsed.source, {
      tempRoot: path.join(parsed.global ? homeDir : cwd, ".skillet", "tmp"),
      insecureHttp: options.insecureHttp,
    });
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const availableSkills = discoverSourceSkills(resolved.contentPath);
  if (availableSkills.length === 0) {
    stderr(`No skills discovered in source: ${parsed.source}`);
    return 1;
  }

  if (parsed.list) {
    for (const skill of availableSkills) {
      stdout(`${skill.name}\t${skill.description}\t${skill.path}`);
    }
    return 0;
  }

  let selectedSkills: SourceSkill[];
  try {
    selectedSkills = selectSkills({
      parsed,
      availableSkills,
      promptSelectSkills: options.promptSelectSkills,
    });
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  let selectedAgents: AgentName[];
  try {
    selectedAgents = selectAgents({
      parsed,
      cwd,
      homeDir,
      promptSelectAgents: options.promptSelectAgents,
    });
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const installMethod = selectInstallMethod(parsed, options.promptSelectInstallMethod);

  const pathMap = getAgentPathMap({ cwd, homeDir });
  const storageRoot = path.join(parsed.global ? homeDir : cwd, ".skillet", "storage");
  const sourceMetadata = {
    type: resolved.type,
    url: resolved.url,
    ref: resolved.ref,
    digest: resolved.digest,
  };

  for (const agent of selectedAgents) {
    const targetSkillsDir = parsed.global ? pathMap[agent].global : pathMap[agent].project;

    for (const skill of selectedSkills) {
      const installed = installSkill({
        sourceId: `${resolved.type}:${resolved.url}:${resolved.ref ?? ""}:${resolved.digest ?? ""}`,
        sourceSkillPath: skill.path,
        storageRoot,
        targetSkillsDir,
        preferCopy: installMethod === "copy",
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
    }
  }

  const lock = generateLockfile({
    scope: parsed.global ? "global" : "project",
    cwd,
    homeDir,
  });

  if (options.verbose) {
    stdout(`Updated lockfile: ${lock.outputPath}`);
  }

  return 0;
}

type ParsedAddArgs = {
  source?: string;
  list: boolean;
  global: boolean;
  yes: boolean;
  all: boolean;
  copy: boolean;
  skills: string[];
  agents: AgentName[];
};

function parseAddArgs(args: string[]): ParsedAddArgs {
  const parsed: ParsedAddArgs = {
    list: false,
    global: false,
    yes: false,
    all: false,
    copy: false,
    skills: [],
    agents: [],
  };

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];

    if (token === "--list" || token === "-l") {
      parsed.list = true;
      continue;
    }

    if (token === "--all") {
      parsed.all = true;
      parsed.yes = true;
      parsed.skills = ["*"];
      continue;
    }

    if (token === "-g" || token === "--global") {
      parsed.global = true;
      continue;
    }

    if (token === "-y" || token === "--yes") {
      parsed.yes = true;
      continue;
    }

    if (token === "--copy") {
      parsed.copy = true;
      continue;
    }

    if (token === "-s" || token === "--skill") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("Missing value for --skill");
      }
      parsed.skills.push(...splitListValue(value));
      i += 1;
      continue;
    }

    if (token === "-a" || token === "--agent") {
      const value = args[i + 1];
      if (!value) {
        throw new Error("Missing value for --agent");
      }
      const agentValues = splitListValue(value);
      for (const agent of agentValues) {
        if (agent === "*") {
          parsed.agents = [...KNOWN_AGENTS];
          continue;
        }

        if (!KNOWN_AGENTS.includes(agent as AgentName)) {
          throw new Error(`Unknown agent: ${agent}`);
        }

        parsed.agents.push(agent as AgentName);
      }
      i += 1;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }

    if (!parsed.source) {
      parsed.source = token;
      continue;
    }

    throw new Error(`Unexpected argument: ${token}`);
  }

  parsed.skills = uniqueSorted(parsed.skills);
  parsed.agents = uniqueSorted(parsed.agents) as AgentName[];

  return parsed;
}

function splitListValue(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

type ResolvedSource = {
  type: "git" | "http" | "oci" | "local";
  url: string;
  ref?: string;
  digest?: string;
  contentPath: string;
};

async function resolveSource(
  source: string,
  options: { tempRoot: string; insecureHttp?: boolean }
): Promise<ResolvedSource> {
  if (source.startsWith("oci://")) {
    const resolved = await resolveOciSource(source, {
      tempRoot: options.tempRoot,
      insecureHttp: options.insecureHttp,
    });

    return {
      type: "oci",
      url: source,
      digest: resolved.resolvedDigest,
      contentPath: resolved.contentPath,
    };
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    if (source.endsWith(".zip") || source.endsWith(".tar.gz") || source.endsWith(".tgz")) {
      const resolved = await resolveHttpArchive(source, {
        tempRoot: options.tempRoot,
      });

      return {
        type: "http",
        url: source,
        contentPath: resolved.contentPath,
      };
    }
  }

  if (isDirectory(source)) {
    return {
      type: "local",
      url: `file://${path.resolve(source)}`,
      contentPath: path.resolve(source),
    };
  }

  const resolvedGit = resolveGitSource(source, { tempRoot: options.tempRoot });
  return {
    type: "git",
    url: resolvedGit.parsed.cloneUrl,
    ref: resolvedGit.parsed.ref,
    digest: resolvedGit.commitSha,
    contentPath: resolvedGit.contentPath,
  };
}

type SourceSkill = {
  name: string;
  description: string;
  path: string;
};

function discoverSourceSkills(contentPath: string): SourceSkill[] {
  const candidates = new Set<string>();
  const standardRoots = [
    contentPath,
    path.join(contentPath, "skills"),
    path.join(contentPath, "skills", ".curated"),
    path.join(contentPath, "skills", ".experimental"),
    path.join(contentPath, "skills", ".system"),
  ];

  for (const root of standardRoots) {
    if (!isDirectory(root)) {
      continue;
    }

    candidates.add(root);
    for (const child of listChildDirectories(root)) {
      candidates.add(child);
    }
  }

  const seen = new Set<string>();
  const skills: SourceSkill[] = [];

  const addFromDirectory = (skillDir: string): void => {
    const skillFile = path.join(skillDir, "SKILL.md");
    if (!isFile(skillFile)) {
      return;
    }

    try {
      const parsed = parseSkillMarkdown(fs.readFileSync(skillFile, "utf8"), { path: skillFile });
      if (seen.has(parsed.frontmatter.name)) {
        return;
      }

      seen.add(parsed.frontmatter.name);
      skills.push({
        name: parsed.frontmatter.name,
        description: parsed.frontmatter.description,
        path: skillDir,
      });
    } catch {
      // Ignore invalid skills in source package.
    }
  };

  for (const candidate of [...candidates].sort((a, b) => a.localeCompare(b))) {
    addFromDirectory(candidate);
  }

  if (skills.length === 0) {
    for (const skillFile of findSkillFiles(contentPath)) {
      addFromDirectory(path.dirname(skillFile));
    }
  }

  return skills.sort((left, right) => left.name.localeCompare(right.name));
}

function findSkillFiles(root: string): string[] {
  const files: string[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) {
      continue;
    }

    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name === "SKILL.md") {
        files.push(fullPath);
      }
    }
  }

  return files.sort((a, b) => a.localeCompare(b));
}

function listChildDirectories(root: string): string[] {
  const directories: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(fullPath))) {
      directories.push(fullPath);
    }
  }

  return directories;
}

function selectSkills(options: {
  parsed: ParsedAddArgs;
  availableSkills: SourceSkill[];
  promptSelectSkills?: PromptSelectSkills;
}): SourceSkill[] {
  const names = options.availableSkills.map((skill) => skill.name);

  if (options.parsed.skills.includes("*")) {
    return options.availableSkills;
  }

  if (options.parsed.skills.length > 0) {
    const missing = options.parsed.skills.filter((name) => !names.includes(name));
    if (missing.length > 0) {
      throw new Error(`Requested skill(s) not found: ${missing.join(", ")}`);
    }

    return options.availableSkills.filter((skill) => options.parsed.skills.includes(skill.name));
  }

  if (options.parsed.yes) {
    return options.availableSkills;
  }

  if (options.promptSelectSkills) {
    const selected = uniqueSorted(options.promptSelectSkills(names));
    if (selected.length === 0) {
      throw new Error("No skills selected.");
    }

    const missing = selected.filter((name) => !names.includes(name));
    if (missing.length > 0) {
      throw new Error(`Selected skill(s) not found: ${missing.join(", ")}`);
    }

    return options.availableSkills.filter((skill) => selected.includes(skill.name));
  }

  return options.availableSkills;
}

function selectAgents(options: {
  parsed: ParsedAddArgs;
  cwd: string;
  homeDir: string;
  promptSelectAgents?: PromptSelectAgents;
}): AgentName[] {
  if (options.parsed.agents.length > 0) {
    return options.parsed.agents;
  }

  return resolveTargetAgents({
    cwd: options.cwd,
    homeDir: options.homeDir,
    promptWhenNone: options.promptSelectAgents,
  });
}

function selectInstallMethod(
  parsed: ParsedAddArgs,
  promptSelectInstallMethod?: PromptSelectInstallMethod
): InstallMethod {
  if (parsed.copy) {
    return "copy";
  }

  if (parsed.yes) {
    return "symlink";
  }

  if (promptSelectInstallMethod) {
    return promptSelectInstallMethod();
  }

  return "symlink";
}

function uniqueSorted<T extends string>(items: T[]): T[] {
  return [...new Set(items)].sort((left, right) => left.localeCompare(right)) as T[];
}

function isDirectory(candidatePath: string): boolean {
  try {
    return fs.statSync(path.resolve(candidatePath)).isDirectory();
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
