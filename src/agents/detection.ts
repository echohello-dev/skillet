import fs from "node:fs";
import path from "node:path";

export class AgentDetectionError extends Error {}

export const KNOWN_AGENTS = ["claude", "codex", "opencode", "cursor", "windsurf"] as const;

export type AgentName = (typeof KNOWN_AGENTS)[number];

export type AgentPathMap = Record<
  AgentName,
  {
    project: string;
    global: string;
  }
>;

export type DetectedAgent = {
  agent: AgentName;
  locations: Array<"project" | "global">;
  paths: string[];
};

export type ResolveTargetAgentsOptions = {
  cwd?: string;
  homeDir?: string;
  explicitAgents?: AgentName[];
  promptWhenNone?: (availableAgents: AgentName[]) => AgentName[];
};

export function getAgentPathMap(options: { cwd?: string; homeDir?: string } = {}): AgentPathMap {
  const cwd = path.resolve(options.cwd ?? process.cwd());
  const homeDir = path.resolve(options.homeDir ?? cwd);

  return {
    claude: {
      project: path.join(cwd, ".claude", "skills"),
      global: path.join(homeDir, ".claude", "skills"),
    },
    codex: {
      project: path.join(cwd, ".codex", "skills"),
      global: path.join(homeDir, ".codex", "skills"),
    },
    opencode: {
      project: path.join(cwd, ".opencode", "skills"),
      global: path.join(homeDir, ".opencode", "skills"),
    },
    cursor: {
      project: path.join(cwd, ".cursor", "skills"),
      global: path.join(homeDir, ".cursor", "skills"),
    },
    windsurf: {
      project: path.join(cwd, ".windsurf", "skills"),
      global: path.join(homeDir, ".windsurf", "skills"),
    },
  };
}

export function detectInstalledAgents(options: { cwd?: string; homeDir?: string } = {}): DetectedAgent[] {
  const pathMap = getAgentPathMap(options);
  const detected: DetectedAgent[] = [];

  for (const agent of KNOWN_AGENTS) {
    const locations: Array<"project" | "global"> = [];
    const paths: string[] = [];

    for (const location of ["project", "global"] as const) {
      const candidate = pathMap[agent][location];
      if (isDirectory(candidate)) {
        locations.push(location);
        paths.push(candidate);
      }
    }

    if (locations.length > 0) {
      detected.push({
        agent,
        locations,
        paths,
      });
    }
  }

  return detected.sort((left, right) => left.agent.localeCompare(right.agent));
}

export function resolveTargetAgents(options: ResolveTargetAgentsOptions = {}): AgentName[] {
  if (options.explicitAgents && options.explicitAgents.length > 0) {
    return normalizeAgents(options.explicitAgents);
  }

  const detected = detectInstalledAgents(options).map((item) => item.agent);
  if (detected.length > 0) {
    return normalizeAgents(detected);
  }

  if (options.promptWhenNone) {
    const selected = options.promptWhenNone([...KNOWN_AGENTS]);
    return normalizeAgents(selected);
  }

  throw new AgentDetectionError(
    "No supported agents detected. Specify --agent explicitly or install an agent skills directory."
  );
}

function normalizeAgents(agents: AgentName[]): AgentName[] {
  const invalid = agents.filter((agent) => !KNOWN_AGENTS.includes(agent));
  if (invalid.length > 0) {
    throw new AgentDetectionError(`Unknown agent(s): ${invalid.join(", ")}`);
  }

  return [...new Set(agents)].sort((left, right) => left.localeCompare(right)) as AgentName[];
}

function isDirectory(candidatePath: string): boolean {
  try {
    return fs.statSync(candidatePath).isDirectory();
  } catch {
    return false;
  }
}
