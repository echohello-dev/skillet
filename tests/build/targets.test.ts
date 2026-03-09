import { describe, expect, test } from "vitest";
import { RELEASE_TARGETS, getHostBuildTargetId } from "../../src/build/targets";

describe("release target matrix", () => {
  test("includes all required build targets with expected naming", () => {
    const ids = RELEASE_TARGETS.map((target) => target.id);
    expect(ids).toEqual([
      "darwin-arm64",
      "darwin-x64",
      "windows-x64",
      "linux-x64-gnu",
      "linux-x64-musl",
      "linux-arm64-gnu",
      "linux-arm64-musl",
    ]);

    const artifactNames = RELEASE_TARGETS.map((target) => target.artifactName);
    expect(artifactNames).toEqual([
      "sklt-darwin-arm64",
      "sklt-darwin-x64",
      "sklt-windows-x64.exe",
      "sklt-linux-x64-gnu",
      "sklt-linux-x64-musl",
      "sklt-linux-arm64-gnu",
      "sklt-linux-arm64-musl",
    ]);
  });

  test("maps host platform/arch to runnable artifact target", () => {
    expect(getHostBuildTargetId("darwin", "arm64")).toBe("darwin-arm64");
    expect(getHostBuildTargetId("darwin", "x64")).toBe("darwin-x64");
    expect(getHostBuildTargetId("linux", "x64")).toBe("linux-x64-gnu");
    expect(getHostBuildTargetId("linux", "arm64")).toBe("linux-arm64-gnu");
    expect(getHostBuildTargetId("win32", "x64")).toBe("windows-x64");
  });
});
