import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

function main(): void {
  const repoRoot = process.cwd();
  const outputPath = path.join(repoRoot, "dist", "npm", "cli.js");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  execFileSync(
    "bun",
    ["build", "src/cli.ts", "--bundle", "--target=node", `--outfile=${outputPath}`],
    { cwd: repoRoot, stdio: ["ignore", "inherit", "inherit"] },
  );

  const output = fs.readFileSync(outputPath, "utf8");
  if (!output.startsWith("#!/usr/bin/env node")) {
    fs.writeFileSync(outputPath, `#!/usr/bin/env node\n${output}`);
  }

  fs.chmodSync(outputPath, 0o755);
  console.log(`Wrote npm CLI bundle to ${outputPath}`);
}

main();
