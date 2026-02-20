import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { RELEASE_TARGETS, getHostBuildTargetId } from "../src/build/targets";

function main(): void {
  const hostId = getHostBuildTargetId(process.platform, process.arch);
  if (!hostId) {
    console.log(`No smoke target mapping for ${process.platform}/${process.arch}`);
    return;
  }

  const hostTarget = RELEASE_TARGETS.find((target) => target.id === hostId);
  if (!hostTarget) {
    throw new Error(`Host target not found in RELEASE_TARGETS: ${hostId}`);
  }

  const artifactPath = path.join(process.cwd(), "dist", hostTarget.artifactName);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Host artifact missing: ${artifactPath}`);
  }

  const output = execFileSync(artifactPath, ["--version"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (!output.includes("skillet/")) {
    throw new Error(`Unexpected smoke output: ${output}`);
  }

  console.log(`Smoke test passed for ${hostId}: ${output.trim()}`);
}

main();
