import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, test } from "vitest";
import {
  OciResolveError,
  parseOciReference,
  resolveOciSource,
} from "../../src/resolvers/oci";

const tempDirs: string[] = [];
const servers: Server[] = [];

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function sha256Digest(buffer: Buffer): string {
  return `sha256:${crypto.createHash("sha256").update(buffer).digest("hex")}`;
}

function createTarBuffer(rootName: string, files: Record<string, string>): Buffer {
  const temp = makeTempDir("skillet-oci-fixture-");
  const root = path.join(temp, rootName);
  fs.mkdirSync(root, { recursive: true });

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    fs.writeFileSync(absolutePath, contents);
  }

  const tarPath = path.join(temp, `${rootName}.tar`);
  execFileSync("tar", ["-cf", tarPath, "-C", temp, rootName]);
  return fs.readFileSync(tarPath);
}

async function startOciServer(payloads: {
  goodTar: Buffer;
  multiTar: Buffer;
}): Promise<string> {
  const goodLayerDigest = sha256Digest(payloads.goodTar);
  const multiLayerDigest = sha256Digest(payloads.multiTar);
  const goodManifestDigest = sha256Digest(Buffer.from("good-manifest"));
  const multiManifestDigest = sha256Digest(Buffer.from("multi-manifest"));
  const badTypeManifestDigest = sha256Digest(Buffer.from("bad-type-manifest"));

  const server = createServer((req, res) => {
    const route = req.url ?? "";

    if (route === "/v2/" || route === "/v2") {
      res.statusCode = 200;
      res.end();
      return;
    }

    const manifests: Record<string, { digest: string; body: unknown }> = {
      "/v2/org/skill/manifests/latest": {
        digest: goodManifestDigest,
        body: {
          schemaVersion: 2,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          artifactType: "application/vnd.skillet.skill.v1+tar",
          layers: [
            {
              mediaType: "application/vnd.oci.image.layer.v1.tar",
              digest: goodLayerDigest,
              size: payloads.goodTar.length,
            },
          ],
        },
      },
      [`/v2/org/skill/manifests/${goodManifestDigest}`]: {
        digest: goodManifestDigest,
        body: {
          schemaVersion: 2,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          artifactType: "application/vnd.skillet.skill.v1+tar",
          layers: [
            {
              mediaType: "application/vnd.oci.image.layer.v1.tar",
              digest: goodLayerDigest,
              size: payloads.goodTar.length,
            },
          ],
        },
      },
      "/v2/org/multi/manifests/latest": {
        digest: multiManifestDigest,
        body: {
          schemaVersion: 2,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          artifactType: "application/vnd.skillet.skill.v1+tar",
          layers: [
            {
              mediaType: "application/vnd.oci.image.layer.v1.tar",
              digest: multiLayerDigest,
              size: payloads.multiTar.length,
            },
          ],
        },
      },
      "/v2/org/badtype/manifests/latest": {
        digest: badTypeManifestDigest,
        body: {
          schemaVersion: 2,
          mediaType: "application/vnd.oci.image.manifest.v1+json",
          artifactType: "application/vnd.unknown",
          layers: [
            {
              mediaType: "application/vnd.oci.image.layer.v1.tar",
              digest: goodLayerDigest,
              size: payloads.goodTar.length,
            },
          ],
        },
      },
    };

    const manifest = manifests[route];
    if (manifest) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.oci.image.manifest.v1+json");
      res.setHeader("Docker-Content-Digest", manifest.digest);
      res.end(JSON.stringify(manifest.body));
      return;
    }

    if (route === `/v2/org/skill/blobs/${goodLayerDigest}`) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.oci.image.layer.v1.tar");
      res.end(payloads.goodTar);
      return;
    }

    if (route === `/v2/org/multi/blobs/${multiLayerDigest}`) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/vnd.oci.image.layer.v1.tar");
      res.end(payloads.multiTar);
      return;
    }

    res.statusCode = 404;
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
  servers.push(server);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected TCP server address");
  }

  return `127.0.0.1:${address.port}`;
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

describe("parseOciReference", () => {
  test("parses tag references", () => {
    const parsed = parseOciReference("oci://ghcr.io/org/skill:latest");

    expect(parsed.registry).toBe("ghcr.io");
    expect(parsed.repository).toBe("org/skill");
    expect(parsed.reference).toBe("latest");
    expect(parsed.referenceType).toBe("tag");
  });

  test("parses digest references", () => {
    const parsed = parseOciReference("oci://ghcr.io/org/skill@sha256:abc");

    expect(parsed.referenceType).toBe("digest");
    expect(parsed.reference).toBe("sha256:abc");
  });
});

describe("resolveOciSource", () => {
  test("resolves tag references and returns resolved digest", async () => {
    const registry = await startOciServer({
      goodTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
      }),
      multiTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
        "beta/SKILL.md": "---\nname: beta\ndescription: beta\n---\n",
      }),
    });

    const resolved = await resolveOciSource(`oci://${registry}/org/skill:latest`, {
      tempRoot: makeTempDir("skillet-oci-work-"),
      insecureHttp: true,
    });

    expect(resolved.resolvedDigest).toMatch(/^sha256:/);
    expect(fs.existsSync(path.join(resolved.contentPath, "SKILL.md"))).toBe(true);
  });

  test("resolves digest references", async () => {
    const goodTar = createTarBuffer("artifact", {
      "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
    });
    const digest = sha256Digest(Buffer.from("good-manifest"));
    const registry = await startOciServer({
      goodTar,
      multiTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
        "beta/SKILL.md": "---\nname: beta\ndescription: beta\n---\n",
      }),
    });

    const resolved = await resolveOciSource(`oci://${registry}/org/skill@${digest}`, {
      tempRoot: makeTempDir("skillet-oci-work-"),
      insecureHttp: true,
    });

    expect(resolved.resolvedDigest).toBe(digest);
  });

  test("rejects unsupported artifact types", async () => {
    const registry = await startOciServer({
      goodTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
      }),
      multiTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
        "beta/SKILL.md": "---\nname: beta\ndescription: beta\n---\n",
      }),
    });

    await expect(
      resolveOciSource(`oci://${registry}/org/badtype:latest`, {
        tempRoot: makeTempDir("skillet-oci-work-"),
        insecureHttp: true,
      })
    ).rejects.toThrowError(OciResolveError);
  });

  test("rejects artifacts containing multiple skills", async () => {
    const registry = await startOciServer({
      goodTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
      }),
      multiTar: createTarBuffer("artifact", {
        "alpha/SKILL.md": "---\nname: alpha\ndescription: alpha\n---\n",
        "beta/SKILL.md": "---\nname: beta\ndescription: beta\n---\n",
      }),
    });

    await expect(
      resolveOciSource(`oci://${registry}/org/multi:latest`, {
        tempRoot: makeTempDir("skillet-oci-work-"),
        insecureHttp: true,
      })
    ).rejects.toThrowError(OciResolveError);
  });
});
