import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RELEASE_TARGETS, getHostBuildTargetId } from "../src/build/targets";

function main(): void {
  const args = process.argv.slice(2);
  const hostId = getHostBuildTargetId(process.platform, process.arch);
  const targetId = readArg(args, "--target") ?? hostId;
  const artifactDir = path.resolve(readArg(args, "--artifact-dir") ?? "dist");
  const runner = readArg(args, "--runner");

  if (!targetId) {
    console.log(`No smoke target mapping for ${process.platform}/${process.arch}`);
    return;
  }

  const target = RELEASE_TARGETS.find((candidate) => candidate.id === targetId);
  if (!target) {
    throw new Error(`Target not found in RELEASE_TARGETS: ${targetId}`);
  }

  const artifactPath = path.join(artifactDir, target.artifactName);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Host artifact missing: ${artifactPath}`);
  }

  const command = runner ? runner : artifactPath;
  const commandArgs = runner ? [artifactPath, "--version"] : ["--version"];

  const output = execFileSync(command, commandArgs, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!output.includes("sklt/")) {
    throw new Error(`Unexpected smoke output: ${output}`);
  }

  console.log(`Smoke test passed for ${targetId}: ${output.trim()}`);
}

function readArg(args: string[], name: string): string | undefined {
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (token === name) {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        throw new Error(`Missing value for ${name}`);
      }
      return next;
    }

    const prefix = `${name}=`;
    if (token.startsWith(prefix)) {
      const value = token.slice(prefix.length);
      if (value.length === 0) {
        throw new Error(`Missing value for ${name}`);
      }
      return value;
    }
  }

  return undefined;
}

main();
