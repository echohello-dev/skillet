import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export class GitSourceError extends Error {}

export type ParsedGitSource = {
  original: string;
  cloneUrl: string;
  ref?: string;
  subdirectory?: string;
};

export type ResolvedGitSource = {
  parsed: ParsedGitSource;
  checkoutPath: string;
  contentPath: string;
  commitSha: string;
};

export type ResolveGitSourceOptions = {
  tempRoot?: string;
};

const SHORTHAND_PATTERN = /^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/;
const SSH_PATTERN = /^git@[^:]+:[^\s]+$/;

export function parseGitSource(input: string): ParsedGitSource {
  const original = input.trim();
  if (!original) {
    throw new GitSourceError("Git source cannot be empty");
  }

  const { base, hash } = splitHash(original);
  const tree = parseTreeSource(base);

  let cloneUrl = tree?.cloneUrl ?? normalizeCloneUrl(base);
  let ref = tree?.ref;
  let subdirectory = tree?.subdirectory;

  if (hash) {
    const [hashRef, hashSubdirectory] = hash.split(":", 2);
    if (hashRef) {
      ref = hashRef;
    }
    if (hashSubdirectory) {
      subdirectory = hashSubdirectory;
    }
  }

  if (subdirectory) {
    subdirectory = normalizeSubdirectory(subdirectory);
  }

  if (isLocalPath(cloneUrl)) {
    cloneUrl = resolveLocalPath(cloneUrl);
  }

  return {
    original,
    cloneUrl,
    ref,
    subdirectory,
  };
}

export function resolveGitSource(source: string, options: ResolveGitSourceOptions = {}): ResolvedGitSource {
  const parsed = parseGitSource(source);

  if (isLocalPath(parsed.cloneUrl) && !fs.existsSync(parsed.cloneUrl)) {
    throw new GitSourceError(`Local repository does not exist: ${parsed.cloneUrl}`);
  }

  const tempRoot = path.resolve(options.tempRoot ?? os.tmpdir());
  fs.mkdirSync(tempRoot, { recursive: true });
  const checkoutPath = fs.mkdtempSync(path.join(tempRoot, "skillet-git-"));

  runGit(["clone", "--depth", "1", parsed.cloneUrl, checkoutPath], undefined, "Failed to clone repository");

  if (parsed.ref) {
    runGit(
      ["-C", checkoutPath, "fetch", "--depth", "1", "origin", parsed.ref],
      undefined,
      `Failed to fetch ref '${parsed.ref}'`
    );
    runGit(["-C", checkoutPath, "checkout", "FETCH_HEAD"], undefined, "Failed to checkout fetched ref");
  }

  const commitSha = runGit(["-C", checkoutPath, "rev-parse", "HEAD"], undefined, "Failed to resolve commit SHA");
  const contentPath = resolveContentPath(checkoutPath, parsed.subdirectory);

  return {
    parsed,
    checkoutPath,
    contentPath,
    commitSha,
  };
}

function splitHash(source: string): { base: string; hash?: string } {
  const hashIndex = source.indexOf("#");
  if (hashIndex === -1) {
    return { base: source };
  }

  return {
    base: source.slice(0, hashIndex),
    hash: source.slice(hashIndex + 1),
  };
}

function parseTreeSource(source: string):
  | {
      cloneUrl: string;
      ref?: string;
      subdirectory?: string;
    }
  | undefined {
  if (!source.startsWith("http://") && !source.startsWith("https://")) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(source);
  } catch {
    throw new GitSourceError(`Invalid URL source: ${source}`);
  }

  const pathSegments = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/");
  const treeIndex = pathSegments.indexOf("tree");
  if (treeIndex === -1) {
    return undefined;
  }

  if (treeIndex < 2 || treeIndex + 1 >= pathSegments.length) {
    throw new GitSourceError(`Invalid tree source format: ${source}`);
  }

  const owner = pathSegments[0];
  const repo = pathSegments[1];
  const ref = pathSegments[treeIndex + 1];
  const subdirectorySegments = pathSegments.slice(treeIndex + 2);

  return {
    cloneUrl: `${parsed.protocol}//${parsed.host}/${owner}/${repo}.git`,
    ref: ref || undefined,
    subdirectory: subdirectorySegments.length > 0 ? subdirectorySegments.join("/") : undefined,
  };
}

function normalizeCloneUrl(source: string): string {
  if (SHORTHAND_PATTERN.test(source)) {
    return `https://github.com/${source}.git`;
  }

  if (SSH_PATTERN.test(source)) {
    return source.endsWith(".git") ? source : `${source}.git`;
  }

  if (source.startsWith("http://") || source.startsWith("https://")) {
    const withoutTrailingSlash = source.replace(/\/+$/, "");
    return withoutTrailingSlash.endsWith(".git") ? withoutTrailingSlash : `${withoutTrailingSlash}.git`;
  }

  if (isLocalPath(source)) {
    return source;
  }

  throw new GitSourceError(`Unsupported git source format: ${source}`);
}

function normalizeSubdirectory(subdirectory: string): string {
  const normalized = subdirectory.replace(/^\/+|\/+$/g, "");
  if (!normalized) {
    return normalized;
  }

  if (normalized.includes("..")) {
    throw new GitSourceError(`Invalid subdirectory path: ${subdirectory}`);
  }

  return normalized;
}

function resolveLocalPath(source: string): string {
  if (source.startsWith("file://")) {
    return path.resolve(source.replace("file://", ""));
  }

  if (source.startsWith("~/")) {
    return path.join(os.homedir(), source.slice(2));
  }

  return path.resolve(source);
}

function resolveContentPath(checkoutPath: string, subdirectory?: string): string {
  if (!subdirectory) {
    return checkoutPath;
  }

  const resolved = path.resolve(checkoutPath, subdirectory);
  const relative = path.relative(checkoutPath, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new GitSourceError(`Subdirectory escapes checkout root: ${subdirectory}`);
  }

  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
    throw new GitSourceError(`Subdirectory not found in repository: ${subdirectory}`);
  }

  return resolved;
}

function runGit(args: string[], cwd: string | undefined, failureMessage: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const details = stderr ? `: ${stderr}` : "";
    throw new GitSourceError(`${failureMessage}${details}`);
  }
}

function isLocalPath(source: string): boolean {
  return (
    source.startsWith(".") ||
    source.startsWith("/") ||
    source.startsWith("~/") ||
    source.startsWith("file://")
  );
}
