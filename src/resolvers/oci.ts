import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export class OciResolveError extends Error {}

export type ParsedOciReference = {
  registry: string;
  repository: string;
  referenceType: "tag" | "digest";
  reference: string;
};

export type ResolveOciSourceOptions = {
  tempRoot?: string;
  insecureHttp?: boolean;
};

export type ResolvedOciSource = {
  parsed: ParsedOciReference;
  resolvedDigest: string;
  extractPath: string;
  contentPath: string;
};

const SKILLET_ARTIFACT_TYPE = "application/vnd.skillet.skill.v1+tar";

export function parseOciReference(source: string): ParsedOciReference {
  const trimmed = source.trim();
  if (!trimmed.startsWith("oci://")) {
    throw new OciResolveError("OCI reference must start with oci://");
  }

  const withoutScheme = trimmed.slice("oci://".length);
  const slashIndex = withoutScheme.indexOf("/");
  if (slashIndex <= 0) {
    throw new OciResolveError(`Invalid OCI reference: ${source}`);
  }

  const registry = withoutScheme.slice(0, slashIndex);
  const remainder = withoutScheme.slice(slashIndex + 1);

  if (!registry || !remainder) {
    throw new OciResolveError(`Invalid OCI reference: ${source}`);
  }

  if (remainder.includes("@")) {
    const [repository, digest] = remainder.split("@", 2);
    if (!repository || !digest) {
      throw new OciResolveError(`Invalid OCI digest reference: ${source}`);
    }

    return {
      registry,
      repository,
      referenceType: "digest",
      reference: digest,
    };
  }

  const tagIndex = remainder.lastIndexOf(":");
  if (tagIndex <= 0 || tagIndex === remainder.length - 1) {
    throw new OciResolveError(`OCI tag reference must include :tag or @digest: ${source}`);
  }

  return {
    registry,
    repository: remainder.slice(0, tagIndex),
    referenceType: "tag",
    reference: remainder.slice(tagIndex + 1),
  };
}

export async function resolveOciSource(
  source: string,
  options: ResolveOciSourceOptions = {}
): Promise<ResolvedOciSource> {
  const parsed = parseOciReference(source);
  const scheme = options.insecureHttp || isLocalRegistry(parsed.registry) ? "http" : "https";

  const tempRoot = path.resolve(options.tempRoot ?? os.tmpdir());
  fs.mkdirSync(tempRoot, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(tempRoot, "skillet-oci-"));

  const manifestUrl = `${scheme}://${parsed.registry}/v2/${parsed.repository}/manifests/${parsed.reference}`;
  const manifestResponse = await fetchWithErrors(manifestUrl, {
    headers: {
      Accept: "application/vnd.oci.image.manifest.v1+json, application/vnd.oci.artifact.manifest.v1+json",
    },
  });

  const manifestText = await manifestResponse.text();
  let manifest: unknown;
  try {
    manifest = JSON.parse(manifestText);
  } catch {
    throw new OciResolveError("Manifest response was not valid JSON");
  }

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    throw new OciResolveError("Manifest body must be a JSON object");
  }

  const manifestRecord = manifest as Record<string, unknown>;
  const artifactType = manifestRecord.artifactType;
  if (artifactType !== SKILLET_ARTIFACT_TYPE) {
    throw new OciResolveError(`Unsupported OCI artifact type: ${String(artifactType ?? "missing")}`);
  }

  const layers = manifestRecord.layers;
  if (!Array.isArray(layers) || layers.length === 0) {
    throw new OciResolveError("Manifest must include at least one layer");
  }

  const firstLayer = layers[0];
  if (!firstLayer || typeof firstLayer !== "object" || Array.isArray(firstLayer)) {
    throw new OciResolveError("Manifest layer entry is invalid");
  }

  const layerDigest = (firstLayer as Record<string, unknown>).digest;
  if (typeof layerDigest !== "string" || !layerDigest.startsWith("sha256:")) {
    throw new OciResolveError("Manifest layer digest is invalid");
  }

  const blobUrl = `${scheme}://${parsed.registry}/v2/${parsed.repository}/blobs/${layerDigest}`;
  const blobResponse = await fetchWithErrors(blobUrl);
  const blobBuffer = Buffer.from(await blobResponse.arrayBuffer());

  const archivePath = path.join(workDir, "layer.tar");
  fs.writeFileSync(archivePath, blobBuffer);

  const tarEntries = listTarEntries(archivePath);
  for (const entry of tarEntries) {
    validateTarEntry(entry);
  }

  const extractPath = path.join(workDir, "extract");
  fs.mkdirSync(extractPath, { recursive: true });
  runTar(["-xf", archivePath, "-C", extractPath], "Failed to extract OCI layer tar");

  const skillPaths = findSkillDirectories(extractPath);
  if (skillPaths.length !== 1) {
    throw new OciResolveError(`OCI artifact must contain exactly one skill, found ${skillPaths.length}`);
  }

  const resolvedDigest =
    parsed.referenceType === "digest"
      ? parsed.reference
      : manifestResponse.headers.get("docker-content-digest") ?? digestManifest(manifestText);

  return {
    parsed,
    resolvedDigest,
    extractPath,
    contentPath: skillPaths[0],
  };
}

async function fetchWithErrors(url: string, init?: RequestInit): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new OciResolveError(`OCI request failed for ${url}: ${message}`);
  }

  if (!response.ok) {
    throw new OciResolveError(`OCI request failed (${response.status} ${response.statusText}) for ${url}`);
  }

  return response;
}

function listTarEntries(archivePath: string): string[] {
  const output = runTar(["-tf", archivePath], "Failed to list OCI tar entries");
  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function validateTarEntry(entry: string): void {
  const normalized = entry.replace(/\\/g, "/");
  if (normalized.startsWith("/") || /^[a-zA-Z]:/.test(normalized)) {
    throw new OciResolveError(`Unsafe absolute path in OCI layer: ${entry}`);
  }

  const safe = path.posix.normalize(normalized);
  if (safe === ".." || safe.startsWith("../") || safe.includes("/../")) {
    throw new OciResolveError(`Unsafe traversal path in OCI layer: ${entry}`);
  }
}

function runTar(args: string[], errorPrefix: string): string {
  try {
    return execFileSync("tar", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const details = stderr ? `: ${stderr}` : "";
    throw new OciResolveError(`${errorPrefix}${details}`);
  }
}

function findSkillDirectories(root: string): string[] {
  const skillDirs = new Set<string>();
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
        skillDirs.add(path.dirname(fullPath));
      }
    }
  }

  return [...skillDirs].sort((a, b) => a.localeCompare(b));
}

function digestManifest(manifestJson: string): string {
  return `sha256:${crypto.createHash("sha256").update(manifestJson).digest("hex")}`;
}

function isLocalRegistry(registry: string): boolean {
  return registry.startsWith("localhost") || registry.startsWith("127.0.0.1");
}
