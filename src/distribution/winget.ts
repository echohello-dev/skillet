const WINDOWS_X64_ARTIFACT = "skillet-windows-x64.exe";
const PACKAGE_IDENTIFIER = "echohello-dev.skillet";

export type WingetManifestOptions = {
  version: string;
  releaseUrlBase: string;
  checksumsByArtifact: Map<string, string>;
};

export type WingetManifestFiles = {
  versionManifest: string;
  installerManifest: string;
  localeManifest: string;
};

export function renderWingetManifestFiles(options: WingetManifestOptions): WingetManifestFiles {
  const releaseUrlBase = options.releaseUrlBase.replace(/\/+$/, "");
  const installerUrl = `${releaseUrlBase}/${WINDOWS_X64_ARTIFACT}`;
  const installerSha256 = requireChecksum(options.checksumsByArtifact, WINDOWS_X64_ARTIFACT).toUpperCase();

  return {
    versionManifest: `PackageIdentifier: ${PACKAGE_IDENTIFIER}
PackageVersion: ${options.version}
DefaultLocale: en-US
ManifestType: version
ManifestVersion: 1.6.0
`,
    installerManifest: `PackageIdentifier: ${PACKAGE_IDENTIFIER}
PackageVersion: ${options.version}
Installers:
  - Architecture: x64
    InstallerType: exe
    InstallerUrl: ${installerUrl}
    InstallerSha256: ${installerSha256}
    AppsAndFeaturesEntries:
      - DisplayName: skillet
Commands:
  - skillet
ManifestType: installer
ManifestVersion: 1.6.0
`,
    localeManifest: `PackageIdentifier: ${PACKAGE_IDENTIFIER}
PackageVersion: ${options.version}
PackageLocale: en-US
Publisher: echohello-dev
PublisherUrl: https://github.com/echohello-dev
PublisherSupportUrl: https://github.com/echohello-dev/skillet/issues
Author: echohello-dev
PackageName: skillet
PackageUrl: https://github.com/echohello-dev/skillet
License: MIT
ShortDescription: Portable CLI for managing agent skills.
Moniker: skillet
Tags:
  - cli
  - skills
ManifestType: defaultLocale
ManifestVersion: 1.6.0
`,
  };
}

function requireChecksum(checksumsByArtifact: Map<string, string>, artifactName: string): string {
  const checksum = checksumsByArtifact.get(artifactName);
  if (!checksum) {
    throw new Error(`Missing checksum for artifact: ${artifactName}`);
  }

  return checksum;
}
