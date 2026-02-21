export function parseSha256Sums(contents: string): Map<string, string> {
  const checksums = new Map<string, string>();

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      continue;
    }

    const match = /^([a-fA-F0-9]{64})\s{2}(.+)$/.exec(line);
    if (!match) {
      throw new Error(`Invalid SHA256SUMS line: ${rawLine}`);
    }

    checksums.set(match[2], match[1].toLowerCase());
  }

  return checksums;
}
