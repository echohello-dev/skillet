import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse as parseYaml } from "yaml";
import { parseOciReference } from "../resolvers/oci";

type WriteLine = (line: string) => void;

export type RunCheckCommandOptions = {
  cwd?: string;
  homeDir?: string;
  stdout?: WriteLine;
  stderr?: WriteLine;
};

export type LockfileSourceEntry = {
  type: string;
  url: string;
  ref?: string;
  digest?: string;
  installMethod: string;
  skills: string[];
  agents: string[];
};

export type CheckStatus = "up-to-date" | "outdated" | "unsupported" | "error";

export type CheckResult = {
  source: LockfileSourceEntry;
  skill: string;
  status: CheckStatus;
  currentDigest?: string;
  latestDigest?: string;
  message?: string;
};

export async function runCheckCommand(
  args: string[],
  options: RunCheckCommandOptions = {}
): Promise<number> {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));

  let parsed: { global: boolean };
  try {
    parsed = parseCheckArgs(args);
  } catch (error) {
    stderr(error instanceof Error ? error.message : String(error));
    return 1;
  }
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? os.homedir());

  const lock = loadLockfile(parsed.global ? "global" : "project", cwd, homeDir);
  if (!lock) {
    stderr("No lockfile found. Run add first to generate skillet.lock.yaml.");
    return 1;
  }

  const results = await collectCheckResults(lock.sources);
  for (const result of results) {
    stdout(`${result.skill}\t${result.status}\t${result.source.url}`);
  }

  return 0;
}

export async function collectCheckResults(sources: LockfileSourceEntry[]): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const source of sources) {
    const status = await checkSource(source);

    for (const skill of source.skills) {
      results.push({
        source,
        skill,
        status: status.status,
        currentDigest: source.digest,
        latestDigest: status.latestDigest,
        message: status.message,
      });
    }
  }

  return results.sort((left, right) => left.skill.localeCompare(right.skill));
}

async function checkSource(source: LockfileSourceEntry): Promise<{
  status: CheckStatus;
  latestDigest?: string;
  message?: string;
}> {
  if (source.type === "git") {
    try {
      const latestDigest = getLatestGitDigest(source.url, source.ref);
      if (source.digest && latestDigest !== source.digest) {
        return { status: "outdated", latestDigest };
      }

      return { status: "up-to-date", latestDigest };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (source.type === "oci") {
    try {
      const latestDigest = await getLatestOciDigest(source.url);
      if (source.digest && latestDigest !== source.digest) {
        return { status: "outdated", latestDigest };
      }

      return { status: "up-to-date", latestDigest };
    } catch (error) {
      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return {
    status: "unsupported",
    message: `Source type '${source.type}' is not checked for updates`,
  };
}

function parseCheckArgs(args: string[]): { global: boolean } {
  let global = false;

  for (const token of args) {
    if (token === "-g" || token === "--global") {
      global = true;
      continue;
    }

    if (token.startsWith("-")) {
      throw new Error(`Unknown option: ${token}`);
    }
  }

  return { global };
}

export function loadLockfile(
  scope: "project" | "global",
  cwd: string,
  homeDir: string
): { path: string; sources: LockfileSourceEntry[] } | undefined {
  const lockPath =
    scope === "project" ? path.join(cwd, "skillet.lock.yaml") : path.join(homeDir, ".skillet", "skillet.lock.yaml");

  if (!fs.existsSync(lockPath)) {
    return undefined;
  }

  const parsed = parseYaml(fs.readFileSync(lockPath, "utf8")) as {
    sources?: LockfileSourceEntry[];
  };

  return {
    path: lockPath,
    sources: parsed.sources ?? [],
  };
}

function getLatestGitDigest(url: string, ref?: string): string {
  const requestedRef = ref && ref.length > 0 ? ref : "HEAD";
  const output = runGit(["ls-remote", url, requestedRef]);
  const firstLine = output.split(/\r?\n/).find((line) => line.trim().length > 0);

  if (!firstLine) {
    throw new Error(`Unable to resolve latest git digest for ${url} (${requestedRef})`);
  }

  const [digest] = firstLine.split(/\s+/, 2);
  if (!digest || digest.length < 40) {
    throw new Error(`Unexpected git ls-remote output for ${url}`);
  }

  return digest;
}

function runGit(args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const details = stderr ? `: ${stderr}` : "";
    throw new Error(`git ${args.join(" ")} failed${details}`);
  }
}

async function getLatestOciDigest(source: string): Promise<string> {
  const parsed = parseOciReference(source);
  if (parsed.referenceType === "digest") {
    return parsed.reference;
  }

  const scheme = parsed.registry.startsWith("localhost") || parsed.registry.startsWith("127.0.0.1") ? "http" : "https";
  const url = `${scheme}://${parsed.registry}/v2/${parsed.repository}/manifests/${parsed.reference}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.artifact.manifest.v1+json",
    },
  });

  if (!response.ok) {
    throw new Error(`OCI manifest request failed: ${response.status} ${response.statusText}`);
  }

  const headerDigest = response.headers.get("docker-content-digest");
  if (headerDigest) {
    return headerDigest;
  }

  const bodyText = await response.text();
  return `sha256:${crypto.createHash("sha256").update(bodyText).digest("hex")}`;
}
