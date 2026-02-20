import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function main(): void {
  const distDir = path.join(process.cwd(), "dist");
  if (!fs.existsSync(distDir)) {
    throw new Error("dist/ does not exist");
  }

  const artifactNames = fs
    .readdirSync(distDir)
    .filter((name) => {
      if (name === "build-manifest.json" || name === "SHA256SUMS") {
        return false;
      }

      const fullPath = path.join(distDir, name);
      return fs.statSync(fullPath).isFile();
    })
    .sort((a, b) => a.localeCompare(b));

  if (artifactNames.length === 0) {
    throw new Error("No build artifacts found in dist/");
  }

  const lines = artifactNames.map((name) => {
    const data = fs.readFileSync(path.join(distDir, name));
    const hash = crypto.createHash("sha256").update(data).digest("hex");
    return `${hash}  ${name}`;
  });

  const outputPath = path.join(distDir, "SHA256SUMS");
  fs.writeFileSync(outputPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outputPath}`);
}

main();
