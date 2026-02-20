import os from "node:os";
import path from "node:path";
import { runAddCommand } from "./add";
import { collectCheckResults, loadLockfile, type LockfileSourceEntry } from "./check";

type WriteLine = (line: string) => void;

export type RunUpdateCommandOptions = {
  cwd?: string;
  homeDir?: string;
  yes?: boolean;
  stdout?: WriteLine;
  stderr?: WriteLine;
};

export async function runUpdateCommand(
  args: string[],
  options: RunUpdateCommandOptions = {}
): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));
  let parsed: { global: boolean; yes: boolean };
  try {
    parsed = parseUpdateArgs(args);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (options.yes) {
    parsed.yes = true;
  }

  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? os.homedir());

  const lock = loadLockfile(parsed.global ? "global" : "project", cwd, homeDir);
  if (!lock) {
    stderr("No lockfile found. Run add first to generate skillet.lock.yaml.");
    return 1;
  }

  const results = await collectCheckResults(lock.sources);
  const outdatedBySource = new Map<string, { source: LockfileSourceEntry; skills: string[] }>();

  for (const result of results) {
    if (result.status !== "outdated") {
      continue;
    }

    const key = [
      result.source.type,
      result.source.url,
      result.source.ref ?? "",
      result.source.digest ?? "",
      [...result.source.agents].sort((a, b) => a.localeCompare(b)).join(","),
    ].join("|");

    const existing = outdatedBySource.get(key) ?? {
      source: result.source,
      skills: [],
    };

    if (!existing.skills.includes(result.skill)) {
      existing.skills.push(result.skill);
    }

    outdatedBySource.set(key, existing);
  }

  if (outdatedBySource.size === 0) {
    stdout("No updates available.");
    return 0;
  }

  let failures = 0;

  for (const { source, skills } of outdatedBySource.values()) {
    const addArgs = buildAddArgs(source, skills, parsed.global);
    const updateExit = await runAddCommand(addArgs, {
      cwd,
      homeDir,
      yes: true,
      stdout,
      stderr,
    });

    if (updateExit !== 0) {
      failures += 1;
      for (const skill of skills) {
        stderr(`${skill}\tfailed\t${source.url}`);
      }
      continue;
    }

    for (const skill of skills) {
      stdout(`${skill}\tupdated\t${source.url}`);
    }
  }

  return failures === 0 ? 0 : 1;
}

function parseUpdateArgs(args: string[]): { global: boolean; yes: boolean } {
  let global = false;
  let yes = false;

  for (const token of args) {
    if (token === "-g" || token === "--global") {
      global = true;
      continue;
    }

    if (token === "-y" || token === "--yes") {
      yes = true;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return { global, yes };
}

function buildAddArgs(source: LockfileSourceEntry, skills: string[], global: boolean): string[] {
  const args: string[] = [buildSourceArg(source), "--skill", skills.join(",")];

  if (source.agents.length > 0) {
    args.push("--agent", source.agents.join(","));
  }

  if (global) {
    args.push("--global");
  }

  args.push("-y");

  return args;
}

function buildSourceArg(source: LockfileSourceEntry): string {
  if (source.type === "git") {
    return source.ref ? `${source.url}#${source.ref}` : source.url;
  }

  return source.url;
}
