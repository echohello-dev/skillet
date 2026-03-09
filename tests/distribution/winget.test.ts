import { describe, expect, it } from "vitest";
import { renderWingetManifestFiles } from "../../src/distribution/winget";

describe("renderWingetManifestFiles", () => {
  it("renders winget manifest trio with checksum and installer URL", () => {
    const files = renderWingetManifestFiles({
      version: "1.2.3",
      releaseUrlBase: "https://github.com/echohello-dev/skillet/releases/download/v1.2.3",
      checksumsByArtifact: new Map([
        ["sklt-windows-x64.exe", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      ]),
    });

    expect(files.versionManifest).toContain("PackageIdentifier: echohello-dev.sklt");
    expect(files.versionManifest).toContain("PackageVersion: 1.2.3");
    expect(files.installerManifest).toContain(
      "InstallerUrl: https://github.com/echohello-dev/skillet/releases/download/v1.2.3/sklt-windows-x64.exe",
    );
    expect(files.installerManifest).toContain(
      "InstallerSha256: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    );
    expect(files.localeManifest).toContain("PackageName: sklt");
  });
});
