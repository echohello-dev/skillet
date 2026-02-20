import fs from "node:fs";
import path from "node:path";

type WriteLine = (line: string) => void;

export type RunInitCommandOptions = {
  cwd?: string;
  yes?: boolean;
  stdout?: WriteLine;
  stderr?: WriteLine;
  confirmOverwrite?: (skillFilePath: string) => boolean;
};

const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function runInitCommand(args: string[], options: RunInitCommandOptions = {}): number {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));
  const cwd = path.resolve(options.cwd ?? process.cwd());

  const targetArg = args[0] ?? ".";
  const targetDir = path.resolve(cwd, targetArg);
  const skillName = path.basename(targetDir);

  const validationError = validateSkillName(skillName);
  if (validationError) {
    stderr(validationError);
    return 1;
  }

  fs.mkdirSync(targetDir, { recursive: true });
  const skillFilePath = path.join(targetDir, "SKILL.md");

  if (fs.existsSync(skillFilePath) && options.yes !== true) {
    const canOverwrite = options.confirmOverwrite ? options.confirmOverwrite(skillFilePath) : false;
    if (!canOverwrite) {
      stderr(`SKILL.md already exists at ${skillFilePath}. Use --yes to overwrite.`);
      return 1;
    }
  }

  const template = renderSkillTemplate(skillName);
  fs.writeFileSync(skillFilePath, template);

  stdout(`Created ${skillFilePath}`);
  return 0;
}

function validateSkillName(skillName: string): string | undefined {
  if (skillName.length < 1 || skillName.length > 64) {
    return "Skill name must be 1-64 characters.";
  }

  if (!SKILL_NAME_PATTERN.test(skillName)) {
    return "Skill name must be lowercase alphanumeric with optional hyphens (e.g. my-skill).";
  }

  return undefined;
}

function renderSkillTemplate(skillName: string): string {
  const title = skillName
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

  return `---
name: ${skillName}
description: ${title} description.
---

# ${title}

Describe what this skill does and when to use it.
`;
}
