export type BuildTarget = {
  id: string;
  bunTarget: string;
  artifactName: string;
};

export const RELEASE_TARGETS: BuildTarget[] = [
  {
    id: "darwin-arm64",
    bunTarget: "bun-darwin-arm64",
    artifactName: "skillet-darwin-arm64",
  },
  {
    id: "darwin-x64",
    bunTarget: "bun-darwin-x64",
    artifactName: "skillet-darwin-x64",
  },
  {
    id: "windows-x64",
    bunTarget: "bun-windows-x64",
    artifactName: "skillet-windows-x64.exe",
  },
  {
    id: "linux-x64-gnu",
    bunTarget: "bun-linux-x64",
    artifactName: "skillet-linux-x64-gnu",
  },
  {
    id: "linux-x64-musl",
    bunTarget: "bun-linux-x64-musl",
    artifactName: "skillet-linux-x64-musl",
  },
  {
    id: "linux-arm64-gnu",
    bunTarget: "bun-linux-arm64",
    artifactName: "skillet-linux-arm64-gnu",
  },
  {
    id: "linux-arm64-musl",
    bunTarget: "bun-linux-arm64-musl",
    artifactName: "skillet-linux-arm64-musl",
  },
];

export function getHostBuildTargetId(platform: NodeJS.Platform, arch: string): string | undefined {
  if (platform === "darwin" && arch === "arm64") {
    return "darwin-arm64";
  }

  if (platform === "darwin" && arch === "x64") {
    return "darwin-x64";
  }

  if (platform === "linux" && arch === "x64") {
    return "linux-x64-gnu";
  }

  if (platform === "linux" && arch === "arm64") {
    return "linux-arm64-gnu";
  }

  if (platform === "win32" && arch === "x64") {
    return "windows-x64";
  }

  return undefined;
}
