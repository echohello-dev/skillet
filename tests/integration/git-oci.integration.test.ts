import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import { parse as parseYaml } from "yaml";
import { runAddCommand } from "../../src/commands/add";
import { runCheckCommand } from "../../src/commands/check";
import { runUpdateCommand } from "../../src/commands/update";

const tempDirs: string[] = [];
const servers: Server[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runGit(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function createGitSkillRepo(root: string): string {
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo, { recursive: true });

  runGit(["init", "-b", "main"], repo);
  runGit(["config", "user.email", "test@example.com"], repo);
  runGit(["config", "user.name", "Test User"], repo);

  const skillDir = path.join(repo, "skills", "alpha");
  fs.mkdirSync(skillDir, { recursive: true });
  fs.writeFileSync(
    path.join(skillDir, "SKILL.md"),
    "---\nname: alpha\ndescription: Alpha skill\n---\n\n# Alpha\n"
  );
  fs.writeFileSync(path.join(skillDir, "content.txt"), "git-v1\n");

  runGit(["add", "."], repo);
  runGit(["commit", "-m", "initial"], repo);
  return repo;
}

function updateGitSkillRepo(repo: string): void {
  fs.writeFileSync(path.join(repo, "skills", "alpha", "content.txt"), "git-v2\n");
  runGit(["add", "."], repo);
  runGit(["commit", "-m", "update"], repo);
}

function sha256(buffer: Buffer | string): string {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function createTarBuffer(rootName: string, files: Record<string, string>): Buffer {
  const temp = makeTempDir("skillet-int-oci-tar-");
  const root = path.join(temp, rootName);
  fs.mkdirSync(root, { recursive: true });

  for (const [relative, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relative);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents);
  }

  const tarPath = path.join(temp, `${rootName}.tar`);
  execFileSync("tar", ["-cf", tarPath, "-C", temp, rootName]);
  return fs.readFileSync(tarPath);
}

async function startOciServer(payloads: { v1: Buffer; v2: Buffer }): Promise<{
  registry: string;
  setVersion: (version: "v1" | "v2") => void;
}> {
  let version: "v1" | "v2" = "v1";

  const layerDigest = {
    v1: sha256(payloads.v1),
    v2: sha256(payloads.v2),
  };

  const manifestBody = {
    v1: JSON.stringify({
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      artifactType: "application/vnd.skillet.skill.v1+tar",
      layers: [
        {
          mediaType: "application/vnd.oci.image.layer.v1.tar",
          digest: layerDigest.v1,
          size: payloads.v1.length,
        },
      ],
    }),
    v2: JSON.stringify({
      schemaVersion: 2,
      mediaType: "application/vnd.oci.image.manifest.v1+json",
      artifactType: "application/vnd.skillet.skill.v1+tar",
      layers: [
        {
          mediaType: "application/vnd.oci.image.layer.v1.tar",
          digest: layerDigest.v2,
          size: payloads.v2.length,
        },
      ],
    }),
  };

  const manifestDigest = {
    v1: sha256(manifestBody.v1),
    v2: sha256(manifestBody.v2),
  };

  const server = createServer((req, res) => {
    const route = req.url ?? "";

    if (route === "/v2" || route === "/v2/") {
      res.statusCode = 200;
      res.end();
      return;
    }

    if (route === "/v2/org/skill/manifests/latest") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.oci.image.manifest.v1+json");
      res.setHeader("Docker-Content-Digest", manifestDigest[version]);
      res.end(manifestBody[version]);
      return;
    }

    if (route === `/v2/org/skill/blobs/${layerDigest.v1}`) {
      res.statusCode = 200;
      res.end(payloads.v1);
      return;
    }

    if (route === `/v2/org/skill/blobs/${layerDigest.v2}`) {
      res.statusCode = 200;
      res.end(payloads.v2);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP address");
  }

  return {
    registry: `127.0.0.1:${address.port}`,
    setVersion: (next) => {
      version = next;
    },
  };
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

describe("integration: add/check/update", () => {
  test("git source flow", async () => {
    const root = makeTempDir("skillet-int-git-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const repo = createGitSkillRepo(root);

    const addExit = await runAddCommand([`${repo}#main`, "--agent", "codex", "-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(addExit).toBe(0);

    const checkBefore: string[] = [];
    await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => checkBefore.push(line),
      stderr: () => undefined,
    });
    expect(checkBefore.join("\n")).toContain("up-to-date");

    updateGitSkillRepo(repo);

    const checkAfter: string[] = [];
    await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => checkAfter.push(line),
      stderr: () => undefined,
    });
    expect(checkAfter.join("\n")).toContain("outdated");

    const updateExit = await runUpdateCommand(["-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
    });
    expect(updateExit).toBe(0);

    const installed = fs.readFileSync(path.join(cwd, ".codex", "skills", "alpha", "content.txt"), "utf8");
    expect(installed).toBe("git-v2\n");
  });

  test("oci source flow", async () => {
    const root = makeTempDir("skillet-int-oci-");
    const cwd = path.join(root, "workspace");
    const homeDir = path.join(root, "home");
    fs.mkdirSync(cwd, { recursive: true });

    const server = await startOciServer({
      v1: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: Alpha skill\n---\n",
        "alpha/content.txt": "oci-v1\n",
      }),
      v2: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: Alpha skill\n---\n",
        "alpha/content.txt": "oci-v2\n",
      }),
    });

    const source = `oci://${server.registry}/org/skill:latest`;

    const addExit = await runAddCommand([source, "--agent", "codex", "-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
      insecureHttp: true,
    });
    expect(addExit).toBe(0);

    const beforeLock = parseYaml(fs.readFileSync(path.join(cwd, "skillet.lock.yaml"), "utf8")) as {
      sources: Array<{ digest?: string }>;
    };
    const beforeDigest = beforeLock.sources[0]?.digest;

    const checkBefore: string[] = [];
    await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => checkBefore.push(line),
      stderr: () => undefined,
    });
    expect(checkBefore.join("\n")).toContain("up-to-date");

    server.setVersion("v2");

    const checkAfter: string[] = [];
    await runCheckCommand([], {
      cwd,
      homeDir,
      stdout: (line) => checkAfter.push(line),
      stderr: () => undefined,
    });
    expect(checkAfter.join("\n")).toContain("outdated");

    const updateExit = await runUpdateCommand(["-y"], {
      cwd,
      homeDir,
      stdout: () => undefined,
      stderr: () => undefined,
      yes: true,
    });
    expect(updateExit).toBe(0);

    const afterLock = parseYaml(fs.readFileSync(path.join(cwd, "skillet.lock.yaml"), "utf8")) as {
      sources: Array<{ digest?: string }>;
    };
    const afterDigest = afterLock.sources[0]?.digest;
    expect(afterDigest).toBeDefined();
    expect(afterDigest).not.toBe(beforeDigest);

    const installed = fs.readFileSync(path.join(cwd, ".codex", "skills", "alpha", "content.txt"), "utf8");
    expect(installed).toBe("oci-v2\n");
  });
});
