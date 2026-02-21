const WINDOWS_X64_ARTIFACT = "skillet-windows-x64.exe";

export type ChocolateyPackageOptions = {
  version: string;
  releaseUrlBase: string;
  checksumsByArtifact: Map<string, string>;
};

export type ChocolateyPackageFiles = {
  nuspec: string;
  installScript: string;
  uninstallScript: string;
};

export function renderChocolateyPackageFiles(options: ChocolateyPackageOptions): ChocolateyPackageFiles {
  const releaseUrlBase = options.releaseUrlBase.replace(/\/+$/, "");
  const downloadUrl = `${releaseUrlBase}/${WINDOWS_X64_ARTIFACT}`;
  const checksum = requireChecksum(options.checksumsByArtifact, WINDOWS_X64_ARTIFACT);

  return {
    nuspec: `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://schemas.microsoft.com/packaging/2015/06/nuspec.xsd">
  <metadata>
    <id>skillet</id>
    <version>${options.version}</version>
    <title>skillet</title>
    <authors>echohello-dev</authors>
    <projectUrl>https://github.com/echohello-dev/skillet</projectUrl>
    <packageSourceUrl>https://github.com/echohello-dev/skillet</packageSourceUrl>
    <requireLicenseAcceptance>false</requireLicenseAcceptance>
    <description>Portable CLI for managing agent skills.</description>
    <tags>cli skills agent</tags>
  </metadata>
  <files>
    <file src="tools\\**" target="tools" />
  </files>
</package>
`,
    installScript: `$ErrorActionPreference = 'Stop'

$packageName = 'skillet'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binaryPath = Join-Path $toolsDir 'skillet.exe'
$url64 = '${downloadUrl}'
$checksum64 = '${checksum}'

Get-ChocolateyWebFile -PackageName $packageName -FileFullPath $binaryPath -Url64bit $url64 -Checksum64 $checksum64 -ChecksumType64 'sha256'
Install-BinFile -Name 'skillet' -Path $binaryPath
`,
    uninstallScript: `$ErrorActionPreference = 'Stop'
Uninstall-BinFile -Name 'skillet'
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
