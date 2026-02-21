import { describe, expect, it } from "vitest";
import { renderChocolateyPackageFiles } from "../../src/distribution/chocolatey";

describe("renderChocolateyPackageFiles", () => {
  it("renders nuspec and install scripts from checksum data", () => {
    const files = renderChocolateyPackageFiles({
      version: "1.2.3",
      releaseUrlBase: "https://github.com/echohello-dev/skillet/releases/download/v1.2.3",
      checksumsByArtifact: new Map([
        ["skillet-windows-x64.exe", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      ]),
    });

    expect(files.nuspec).toContain("<version>1.2.3</version>");
    expect(files.installScript).toContain(
      "$url64 = 'https://github.com/echohello-dev/skillet/releases/download/v1.2.3/skillet-windows-x64.exe'",
    );
    expect(files.installScript).toContain(
      "$checksum64 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
    );
    expect(files.uninstallScript).toContain("Uninstall-BinFile -Name 'skillet'");
  });
});
