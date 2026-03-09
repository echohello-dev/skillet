import fs from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { parseSha256Sums } from "../src/distribution/checksums";
import { renderChocolateyPackageFiles } from "../src/distribution/chocolatey";
import { renderHomebrewFormula } from "../src/distribution/homebrew";
import { renderWingetManifestFiles } from "../src/distribution/winget";

function main(): void {
  const args = process.argv.slice(2);
  const version = readArg(args, "--version") ?? readVersionFromPackageJson();
  const checksumsPath = path.resolve(readArg(args, "--checksums") ?? "dist/SHA256SUMS");
  const packagingRoot = path.resolve(readArg(args, "--packaging-root") ?? "packaging");
  const releaseUrlBase =
    readArg(args, "--release-url-base") ??
    `https://github.com/echohello-dev/skillet/releases/download/v${version}`;

  if (!fs.existsSync(checksumsPath)) {
    throw new Error(`Checksums file not found: ${checksumsPath}`);
  }

  const checksums = parseSha256Sums(fs.readFileSync(checksumsPath, "utf8"));
  const expectedHomebrew = renderHomebrewFormula({
    version,
    releaseUrlBase,
    checksumsByArtifact: checksums,
  });
  const expectedChocolatey = renderChocolateyPackageFiles({
    version,
    releaseUrlBase,
    checksumsByArtifact: checksums,
  });
  const expectedWinget = renderWingetManifestFiles({
    version,
    releaseUrlBase,
    checksumsByArtifact: checksums,
  });

  const wingetDir = path.join(packagingRoot, "winget", version);
  const wingetVersionPath = path.join(wingetDir, "echohello-dev.skillet.yaml");
  const wingetInstallerPath = path.join(wingetDir, "echohello-dev.skillet.installer.yaml");
  const wingetLocalePath = path.join(wingetDir, "echohello-dev.skillet.locale.en-US.yaml");

  assertContains(expectedHomebrew, `version \"${version}\"`, "generated Homebrew formula");
  assertContains(expectedChocolatey.nuspec, `<version>${version}</version>`, "generated Chocolatey nuspec");
  assertContains(expectedChocolatey.installScript, releaseUrlBase, "generated Chocolatey install script");
  assertContains(expectedWinget.installerManifest, releaseUrlBase, "generated winget installer manifest");

  const versionManifest = parse(expectedWinget.versionManifest) as Record<string, unknown>;
  const installerManifest = parse(expectedWinget.installerManifest) as Record<string, unknown>;
  const localeManifest = parse(expectedWinget.localeManifest) as Record<string, unknown>;

  assertField(versionManifest, "PackageVersion", version, "generated winget version manifest");
  assertField(versionManifest, "ManifestType", "version", "generated winget version manifest");
  assertField(installerManifest, "PackageVersion", version, "generated winget installer manifest");
  assertField(installerManifest, "ManifestType", "installer", "generated winget installer manifest");
  assertField(localeManifest, "PackageVersion", version, "generated winget locale manifest");
  assertField(localeManifest, "ManifestType", "defaultLocale", "generated winget locale manifest");

  assertCheckedInPackagingFilesExist(packagingRoot, version);
  assertField(parse(fs.readFileSync(wingetVersionPath, "utf8")) as Record<string, unknown>, "ManifestType", "version", wingetVersionPath);
  assertField(parse(fs.readFileSync(wingetInstallerPath, "utf8")) as Record<string, unknown>, "ManifestType", "installer", wingetInstallerPath);
  assertField(parse(fs.readFileSync(wingetLocalePath, "utf8")) as Record<string, unknown>, "ManifestType", "defaultLocale", wingetLocalePath);

  console.log(`Validated packaging assets for ${version}`);
}

function assertCheckedInPackagingFilesExist(packagingRoot: string, version: string): void {
  const requiredPaths = [
    path.join(packagingRoot, "homebrew", "skillet.rb"),
    path.join(packagingRoot, "chocolatey", "skillet.nuspec"),
    path.join(packagingRoot, "chocolatey", "tools", "chocolateyinstall.ps1"),
    path.join(packagingRoot, "chocolatey", "tools", "chocolateyuninstall.ps1"),
    path.join(packagingRoot, "winget", version, "echohello-dev.skillet.yaml"),
    path.join(packagingRoot, "winget", version, "echohello-dev.skillet.installer.yaml"),
    path.join(packagingRoot, "winget", version, "echohello-dev.skillet.locale.en-US.yaml"),
  ];

  for (const filePath of requiredPaths) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Packaging file not found: ${filePath}`);
    }
  }
}

function assertContains(contents: string, expectedFragment: string, label: string): void {
  if (!contents.includes(expectedFragment)) {
    throw new Error(`Missing expected content in ${label}: ${expectedFragment}`);
  }
}

function assertField(
  document: Record<string, unknown>,
  field: string,
  expectedValue: string,
  filePath: string,
): void {
  const actualValue = document[field];
  if (actualValue !== expectedValue) {
    throw new Error(`Unexpected ${field} in ${filePath}: ${String(actualValue)}`);
  }
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

function readVersionFromPackageJson(): string {
  const packageJsonPath = path.resolve("package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8")) as { version?: string };
  if (!packageJson.version || packageJson.version.length === 0) {
    throw new Error("package.json version is missing");
  }

  return packageJson.version;
}

main();
