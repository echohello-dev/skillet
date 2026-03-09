const DARWIN_ARM64_ARTIFACT = "sklt-darwin-arm64";
const DARWIN_X64_ARTIFACT = "sklt-darwin-x64";

export type HomebrewFormulaOptions = {
  version: string;
  releaseUrlBase: string;
  checksumsByArtifact: Map<string, string>;
};

export function renderHomebrewFormula(options: HomebrewFormulaOptions): string {
  const arm64Sha = requireChecksum(options.checksumsByArtifact, DARWIN_ARM64_ARTIFACT);
  const x64Sha = requireChecksum(options.checksumsByArtifact, DARWIN_X64_ARTIFACT);
  const releaseUrlBase = options.releaseUrlBase.replace(/\/+$/, "");

  return `class Sklt < Formula
  desc "Portable CLI for managing agent skills"
  homepage "https://github.com/echohello-dev/skillet"
  version "${options.version}"

  on_arm do
    url "${releaseUrlBase}/${DARWIN_ARM64_ARTIFACT}"
    sha256 "${arm64Sha}"
  end

  on_intel do
    url "${releaseUrlBase}/${DARWIN_X64_ARTIFACT}"
    sha256 "${x64Sha}"
  end

  def install
    artifact = Hardware::CPU.arm? ? "${DARWIN_ARM64_ARTIFACT}" : "${DARWIN_X64_ARTIFACT}"
    bin.install artifact => "sklt"
  end

  test do
    assert_match "sklt/", shell_output("#{bin}/sklt --version")
  end
end
`;
}

function requireChecksum(checksumsByArtifact: Map<string, string>, artifactName: string): string {
  const checksum = checksumsByArtifact.get(artifactName);
  if (!checksum) {
    throw new Error(`Missing checksum for artifact: ${artifactName}`);
  }

  return checksum;
}
