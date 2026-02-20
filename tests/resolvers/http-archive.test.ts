import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { ArchiveResolveError, resolveHttpArchive } from "../../src/resolvers/http-archive";

const tempDirs: string[] = [];
const servers: Server[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function run(cmd: string, args: string[], cwd: string): void {
  execFileSync(cmd, args, { cwd, stdio: "ignore" });
}

function createArchives(root: string): {
  tarGzPath: string;
  zipPath: string;
  unsafeZipPath: string;
  invalidZipPath: string;
} {
  const sources = path.join(root, "sources");
  fs.mkdirSync(sources, { recursive: true });

  const tarRoot = path.join(sources, "tar-src", "bundle", "alpha");
  fs.mkdirSync(tarRoot, { recursive: true });
  fs.writeFileSync(path.join(tarRoot, "SKILL.md"), "---\nname: alpha\ndescription: alpha\n---\n");
  const tarGzPath = path.join(root, "skill.tar.gz");
  run("tar", ["-czf", tarGzPath, "bundle"], path.join(sources, "tar-src"));

  const zipRoot = path.join(sources, "zip-src", "bundlezip", "beta");
  fs.mkdirSync(zipRoot, { recursive: true });
  fs.writeFileSync(path.join(zipRoot, "SKILL.md"), "---\nname: beta\ndescription: beta\n---\n");
  const zipPath = path.join(root, "skill.zip");
  run("zip", ["-r", zipPath, "bundlezip"], path.join(sources, "zip-src"));

  const unsafeDir = path.join(sources, "unsafe");
  fs.mkdirSync(path.join(unsafeDir, "nested"), { recursive: true });
  fs.writeFileSync(path.join(unsafeDir, "evil.txt"), "evil");
  const unsafeZipPath = path.join(root, "unsafe.zip");
  run("zip", [unsafeZipPath, "../evil.txt"], path.join(unsafeDir, "nested"));

  const invalidZipPath = path.join(root, "invalid.zip");
  fs.writeFileSync(invalidZipPath, "not an archive");

  return { tarGzPath, zipPath, unsafeZipPath, invalidZipPath };
}

async function startArchiveServer(archives: {
  tarGzPath: string;
  zipPath: string;
  unsafeZipPath: string;
  invalidZipPath: string;
}): Promise<string> {
  const server = createServer((req, res) => {
    const url = req.url ?? "/";

    if (url === "/redirect") {
      res.statusCode = 302;
      res.setHeader("Location", "/skill.tar.gz");
      res.end();
      return;
    }

    const map: Record<string, { path: string; contentType: string }> = {
      "/skill.tar.gz": { path: archives.tarGzPath, contentType: "application/gzip" },
      "/skill.zip": { path: archives.zipPath, contentType: "application/zip" },
      "/unsafe.zip": { path: archives.unsafeZipPath, contentType: "application/zip" },
      "/invalid.zip": { path: archives.invalidZipPath, contentType: "application/zip" },
    };

    const hit = map[url];
    if (!hit) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    res.statusCode = 200;
    res.setHeader("Content-Type", hit.contentType);
    fs.createReadStream(hit.path).pipe(res);
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    )
  );

  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("resolveHttpArchive", () => {
  test("resolves redirected tar.gz archive and normalizes top-level directory", async () => {
    const temp = makeTempDir("skillet-http-archive-");
    const archives = createArchives(temp);
    const baseUrl = await startArchiveServer(archives);

    const resolved = await resolveHttpArchive(`${baseUrl}/redirect`, {
      tempRoot: path.join(temp, "work"),
    });

    expect(resolved.format).toBe("tar.gz");
    expect(path.basename(resolved.contentPath)).toBe("bundle");
    expect(fs.existsSync(path.join(resolved.contentPath, "alpha", "SKILL.md"))).toBe(true);
  });

  test("resolves zip archives", async () => {
    const temp = makeTempDir("skillet-http-archive-");
    const archives = createArchives(temp);
    const baseUrl = await startArchiveServer(archives);

    const resolved = await resolveHttpArchive(`${baseUrl}/skill.zip`, {
      tempRoot: path.join(temp, "work"),
    });

    expect(resolved.format).toBe("zip");
    expect(path.basename(resolved.contentPath)).toBe("bundlezip");
    expect(fs.existsSync(path.join(resolved.contentPath, "beta", "SKILL.md"))).toBe(true);
  });

  test("rejects unsafe path traversal entries", async () => {
    const temp = makeTempDir("skillet-http-archive-");
    const archives = createArchives(temp);
    const baseUrl = await startArchiveServer(archives);

    await expect(
      resolveHttpArchive(`${baseUrl}/unsafe.zip`, {
        tempRoot: path.join(temp, "work"),
      })
    ).rejects.toThrowError(ArchiveResolveError);
  });

  test("enforces download size limits", async () => {
    const temp = makeTempDir("skillet-http-archive-");
    const archives = createArchives(temp);
    const baseUrl = await startArchiveServer(archives);

    await expect(
      resolveHttpArchive(`${baseUrl}/skill.tar.gz`, {
        tempRoot: path.join(temp, "work"),
        maxDownloadBytes: 16,
      })
    ).rejects.toThrowError(ArchiveResolveError);
  });

  test("fails clearly for malformed archives", async () => {
    const temp = makeTempDir("skillet-http-archive-");
    const archives = createArchives(temp);
    const baseUrl = await startArchiveServer(archives);

    await expect(
      resolveHttpArchive(`${baseUrl}/invalid.zip`, {
        tempRoot: path.join(temp, "work"),
      })
    ).rejects.toThrowError(ArchiveResolveError);
  });
});
