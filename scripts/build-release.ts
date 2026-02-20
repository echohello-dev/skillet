import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RELEASE_TARGETS, getHostBuildTargetId } from "../src/build/targets";

type BuildResult = {
  id: string;
  artifactPath: string;
  version: string;
  metadata: string;
};

function main(): void {
  const repoRoot = process.cwd();
  const distDir = path.join(repoRoot, "dist");

  const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8")) as {
    version: string;
  };

  const version = process.env.SKILLET_RELEASE_VERSION ?? packageJson.version;
  const commit = process.env.GIT_COMMIT ?? gitShortCommit(repoRoot);
  const builtAt = new Date().toISOString();

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const results: BuildResult[] = [];

  for (const target of RELEASE_TARGETS) {
    const artifactPath = path.join(distDir, target.artifactName);
    const metadata = [`commit=${commit}`, `builtAt=${builtAt}`, `target=${target.id}`].join(",");

    const args = [
      "build",
      "--compile",
      "--target",
      target.bunTarget,
      "--outfile",
      artifactPath,
      "--env=SKILLET_*",
      "--no-compile-autoload-dotenv",
      "--no-compile-autoload-bunfig",
      path.join(repoRoot, "src", "cli.ts"),
    ];

    if (target.id === "windows-x64" && process.platform === "win32") {
      args.push("--windows-hide-console");
    }

    runBun(args, repoRoot, {
      ...process.env,
      SKILLET_VERSION: version,
      SKILLET_BUILD_METADATA: metadata,
    });

    results.push({
      id: target.id,
      artifactPath,
      version,
      metadata,
    });

    console.log(`Built ${target.id}: ${path.relative(repoRoot, artifactPath)}`);
  }

  verifyHostArtifact(results);

  const manifestPath = path.join(distDir, "build-manifest.json");
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version,
        commit,
        builtAt,
        targets: results.map((result) => ({
          id: result.id,
          artifact: path.basename(result.artifactPath),
          metadata: result.metadata,
        })),
      },
      null,
      2
    )
  );

  console.log(`Wrote ${path.relative(repoRoot, manifestPath)}`);
}

function verifyHostArtifact(results: BuildResult[]): void {
  const hostId = getHostBuildTargetId(process.platform, process.arch);
  if (!hostId) {
    return;
  }

  const hostResult = results.find((result) => result.id === hostId);
  if (!hostResult) {
    throw new Error(`Missing host artifact for ${hostId}`);
  }

  const output = execFileSync(hostResult.artifactPath, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!output.includes(hostResult.version)) {
    throw new Error(`Host artifact version check failed for ${hostId}. Output: ${output}`);
  }

  if (!output.includes(hostResult.metadata)) {
    throw new Error(`Host artifact metadata check failed for ${hostId}. Output: ${output}`);
  }

  console.log(`Verified host artifact ${hostId} reports version and metadata`);
}

function gitShortCommit(cwd: string): string {
  try {
    return execFileSync("git", ["rev-parse", "--short", "HEAD"], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function runBun(args: string[], cwd: string, env: NodeJS.ProcessEnv): void {
  try {
    execFileSync("bun", args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    let stderr = "";
    if (error && typeof error === "object" && "stderr" in error) {
      const raw = (error as { stderr?: unknown }).stderr;
      if (typeof raw === "string") {
        stderr = raw;
      } else if (raw instanceof Uint8Array) {
        stderr = Buffer.from(raw).toString("utf8");
      }
    }
    throw new Error(`bun ${args.join(" ")} failed\n${stderr}`.trim());
  }
}

main();
