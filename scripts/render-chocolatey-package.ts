import fs from "node:fs";
import path from "node:path";
import { parseSha256Sums } from "../src/distribution/checksums";
import { renderChocolateyPackageFiles } from "../src/distribution/chocolatey";

function main(): void {
  const args = process.argv.slice(2);
  const version = readArg(args, "--version") ?? readVersionFromPackageJson();
  const checksumsPath = path.resolve(readArg(args, "--checksums") ?? "dist/SHA256SUMS");
  const outputDir = path.resolve(readArg(args, "--output-dir") ?? "packaging/chocolatey");
  const releaseUrlBase =
    readArg(args, "--release-url-base") ??
    `https://github.com/echohello-dev/skillet/releases/download/v${version}`;

  if (!fs.existsSync(checksumsPath)) {
    throw new Error(`Checksums file not found: ${checksumsPath}`);
  }

  const checksums = parseSha256Sums(fs.readFileSync(checksumsPath, "utf8"));
  const files = renderChocolateyPackageFiles({ version, releaseUrlBase, checksumsByArtifact: checksums });

  fs.mkdirSync(path.join(outputDir, "tools"), { recursive: true });
  fs.writeFileSync(path.join(outputDir, "skillet.nuspec"), files.nuspec);
  fs.writeFileSync(path.join(outputDir, "tools", "chocolateyinstall.ps1"), files.installScript);
  fs.writeFileSync(path.join(outputDir, "tools", "chocolateyuninstall.ps1"), files.uninstallScript);
  console.log(`Wrote Chocolatey package files to ${outputDir}`);
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
