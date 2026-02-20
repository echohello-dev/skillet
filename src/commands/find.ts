import { discoverSkills } from "../skills/discovery";

type WriteLine = (line: string) => void;

export type RunFindCommandOptions = {
  cwd?: string;
  homeDir?: string;
  verbose?: boolean;
  stdout?: WriteLine;
  stderr?: WriteLine;
};

export function runFindCommand(args: string[], options: RunFindCommandOptions = {}): number {
  const stdout = options.stdout ?? ((line: string) => console.log(line));
  const stderr = options.stderr ?? ((line: string) => console.error(line));

  const query = args.join(" ").trim();
  const queryLower = query.toLowerCase();

  const result = discoverSkills({
    cwd: options.cwd,
    homeDir: options.homeDir,
    verbose: options.verbose === true,
  });

  if (options.verbose) {
    for (const warning of result.warnings) {
      stderr(`Warning: ${warning.path}: ${warning.message}`);
    }
  }

  const matches = result.skills
    .filter((skill) => {
      if (!queryLower) {
        return true;
      }

      const name = skill.name.toLowerCase();
      const description = skill.description.toLowerCase();
      return name.includes(queryLower) || description.includes(queryLower);
    })
    .sort((left, right) => {
      const scoreLeft = scoreMatch(left, queryLower);
      const scoreRight = scoreMatch(right, queryLower);

      if (scoreLeft !== scoreRight) {
        return scoreLeft - scoreRight;
      }

      return left.name.localeCompare(right.name);
    });

  if (matches.length === 0) {
    if (query) {
      stdout(`No skills found for "${query}".`);
    } else {
      stdout("No skills found.");
    }
    return 0;
  }

  for (const skill of matches) {
    stdout(`${skill.name}\t${skill.description}\t${skill.path}`);
  }

  return 0;
}

function scoreMatch(skill: { name: string; description: string }, queryLower: string): number {
  if (!queryLower) {
    return 0;
  }

  const name = skill.name.toLowerCase();
  const description = skill.description.toLowerCase();

  if (name === queryLower) {
    return 0;
  }

  if (name.startsWith(queryLower)) {
    return 1;
  }

  if (name.includes(queryLower)) {
    return 2;
  }

  if (description.includes(queryLower)) {
    return 3;
  }

  return 4;
}
