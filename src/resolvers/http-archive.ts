import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export class ArchiveResolveError extends Error {}

export type ArchiveFormat = "zip" | "tar.gz";

export type ResolveHttpArchiveOptions = {
  tempRoot?: string;
  maxDownloadBytes?: number;
  maxEntries?: number;
  maxExtractedBytes?: number;
};

export type ResolvedHttpArchive = {
  format: ArchiveFormat;
  archivePath: string;
  extractPath: string;
  contentPath: string;
  finalUrl: string;
};

const DEFAULT_MAX_DOWNLOAD_BYTES = 50 * 1024 * 1024;
const DEFAULT_MAX_ENTRIES = 10_000;
const DEFAULT_MAX_EXTRACTED_BYTES = 250 * 1024 * 1024;

export async function resolveHttpArchive(
  sourceUrl: string,
  options: ResolveHttpArchiveOptions = {}
): Promise<ResolvedHttpArchive> {
  const tempRoot = path.resolve(options.tempRoot ?? os.tmpdir());
  fs.mkdirSync(tempRoot, { recursive: true });
  const workDir = fs.mkdtempSync(path.join(tempRoot, "skillet-archive-"));

  const maxDownloadBytes = options.maxDownloadBytes ?? DEFAULT_MAX_DOWNLOAD_BYTES;
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxExtractedBytes = options.maxExtractedBytes ?? DEFAULT_MAX_EXTRACTED_BYTES;

  const downloaded = await downloadArchive(sourceUrl, maxDownloadBytes);
  const format = detectArchiveFormat(downloaded.finalUrl, downloaded.contentType, downloaded.buffer);

  const archivePath = path.join(workDir, format === "zip" ? "archive.zip" : "archive.tar.gz");
  fs.writeFileSync(archivePath, downloaded.buffer);

  const entries = listArchiveEntries(archivePath, format);
  if (entries.length > maxEntries) {
    throw new ArchiveResolveError(`Archive entry count exceeds limit (${maxEntries})`);
  }

  for (const entry of entries) {
    validateArchiveEntryPath(entry);
  }

  const extractPath = path.join(workDir, "extract");
  fs.mkdirSync(extractPath, { recursive: true });
  extractArchive(archivePath, format, extractPath);

  const extractedBytes = computeDirectorySize(extractPath);
  if (extractedBytes > maxExtractedBytes) {
    throw new ArchiveResolveError(`Extracted archive size exceeds limit (${maxExtractedBytes} bytes)`);
  }

  return {
    format,
    archivePath,
    extractPath,
    contentPath: normalizeContentPath(extractPath),
    finalUrl: downloaded.finalUrl,
  };
}

type DownloadedArchive = {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
};

async function downloadArchive(url: string, maxDownloadBytes: number): Promise<DownloadedArchive> {
  let response: Response;
  try {
    response = await fetch(url, { redirect: "follow" });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ArchiveResolveError(`Failed to fetch archive: ${message}`);
  }

  if (!response.ok) {
    throw new ArchiveResolveError(`HTTP archive request failed: ${response.status} ${response.statusText}`);
  }

  if (!response.body) {
    throw new ArchiveResolveError("HTTP archive response did not include a body");
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    const chunk = Buffer.from(value);
    totalBytes += chunk.length;

    if (totalBytes > maxDownloadBytes) {
      throw new ArchiveResolveError(`Archive download exceeds limit (${maxDownloadBytes} bytes)`);
    }

    chunks.push(chunk);
  }

  return {
    buffer: Buffer.concat(chunks),
    contentType: response.headers.get("content-type") ?? "",
    finalUrl: response.url,
  };
}

function detectArchiveFormat(finalUrl: string, contentType: string, buffer: Buffer): ArchiveFormat {
  const lowerUrl = finalUrl.toLowerCase();
  const lowerContentType = contentType.toLowerCase();

  if (lowerUrl.endsWith(".tar.gz") || lowerUrl.endsWith(".tgz")) {
    return "tar.gz";
  }

  if (lowerUrl.endsWith(".zip")) {
    return "zip";
  }

  if (lowerContentType.includes("application/zip")) {
    return "zip";
  }

  if (lowerContentType.includes("application/gzip") || lowerContentType.includes("application/x-gzip")) {
    return "tar.gz";
  }

  if (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b) {
    return "tar.gz";
  }

  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) &&
    (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08)
  ) {
    return "zip";
  }

  throw new ArchiveResolveError("Unable to detect archive format (expected .zip or .tar.gz)");
}

function listArchiveEntries(archivePath: string, format: ArchiveFormat): string[] {
  const args = format === "zip" ? ["-Z1", archivePath] : ["-tzf", archivePath];
  const cmd = format === "zip" ? "unzip" : "tar";
  const output = runCommand(cmd, args, "Failed to inspect archive contents");
  return output
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function extractArchive(archivePath: string, format: ArchiveFormat, extractPath: string): void {
  if (format === "zip") {
    runCommand("unzip", ["-q", archivePath, "-d", extractPath], "Failed to extract zip archive");
    return;
  }

  runCommand("tar", ["-xzf", archivePath, "-C", extractPath], "Failed to extract tar.gz archive");
}

function validateArchiveEntryPath(entryPath: string): void {
  const sanitized = entryPath.replace(/\\/g, "/");

  if (sanitized.length === 0) {
    return;
  }

  if (sanitized.startsWith("/") || /^[a-zA-Z]:/.test(sanitized)) {
    throw new ArchiveResolveError(`Archive entry uses absolute path: ${entryPath}`);
  }

  const normalized = path.posix.normalize(sanitized);
  if (normalized === ".." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new ArchiveResolveError(`Archive entry escapes extraction root: ${entryPath}`);
  }
}

function normalizeContentPath(extractPath: string): string {
  const entries = fs
    .readdirSync(extractPath)
    .filter((entry) => entry !== ".DS_Store" && entry !== "__MACOSX");

  if (entries.length === 1) {
    const candidate = path.join(extractPath, entries[0]);
    if (fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }

  return extractPath;
}

function computeDirectorySize(directoryPath: string): number {
  let total = 0;
  const stack = [directoryPath];

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

      if (entry.isFile()) {
        total += fs.statSync(fullPath).size;
      }
    }
  }

  return total;
}

function runCommand(cmd: string, args: string[], errorPrefix: string): string {
  try {
    return execFileSync(cmd, args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    const stderr =
      error instanceof Error && "stderr" in error && typeof error.stderr === "string"
        ? error.stderr.trim()
        : "";
    const details = stderr ? `: ${stderr}` : "";
    throw new ArchiveResolveError(`${errorPrefix}${details}`);
  }
}
