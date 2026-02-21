import { describe, expect, it } from "vitest";
import { parseSha256Sums } from "../../src/distribution/checksums";
import { renderHomebrewFormula } from "../../src/distribution/homebrew";

describe("parseSha256Sums", () => {
  it("parses checksum lines into a map", () => {
    const checksums = parseSha256Sums(
      [
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  skillet-darwin-arm64",
        "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  skillet-darwin-x64",
      ].join("\n"),
    );

    expect(checksums.get("skillet-darwin-arm64")).toBe(
      "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    );
    expect(checksums.get("skillet-darwin-x64")).toBe(
      "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    );
  });
});

describe("renderHomebrewFormula", () => {
  it("renders an arch-aware formula", () => {
    const checksums = new Map<string, string>([
      ["skillet-darwin-arm64", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],
      ["skillet-darwin-x64", "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],
    ]);

    const formula = renderHomebrewFormula({
      version: "1.2.3",
      releaseUrlBase: "https://github.com/echohello-dev/skillet/releases/download/v1.2.3",
      checksumsByArtifact: checksums,
    });

    expect(formula).toContain('version "1.2.3"');
    expect(formula).toContain(
      'url "https://github.com/echohello-dev/skillet/releases/download/v1.2.3/skillet-darwin-arm64"',
    );
    expect(formula).toContain(
      'url "https://github.com/echohello-dev/skillet/releases/download/v1.2.3/skillet-darwin-x64"',
    );
    expect(formula).toContain('sha256 "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"');
    expect(formula).toContain('sha256 "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"');
  });
});
