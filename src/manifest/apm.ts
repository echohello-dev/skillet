import fs from "node:fs";
import path from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { AgentName, KNOWN_AGENTS } from "../agents/detection";

export class ApmManifestError extends Error {}

export type ApmDependency = {
  source: string;
  raw: unknown;
};

export type ApmManifest = {
  name: string;
  version: string;
  description?: string;
  targets?: string[];
  dependencies: ApmDependency[];
};

export function parseApmManifest(content: string): ApmManifest {
  let doc: unknown;
  try {
    doc = parseYaml(content);
  } catch (error) {
    throw new ApmManifestError(
      `Invalid YAML: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  if (!isPlainObject(doc)) {
    throw new ApmManifestError("apm.yml must be a YAML mapping");
  }

  const name = readRequiredString(doc, "name");
  const version = readRequiredString(doc, "version");
  const description = readOptionalString(doc, "description");

  const targets = parseTargets(doc);

  const dependencies: ApmDependency[] = [];
  const depsBlock = readOptionalObject(doc, "dependencies");
  if (depsBlock) {
    const apmDeps = readOptionalArray(depsBlock, "apm");
    if (apmDeps) {
      for (const dep of apmDeps) {
        dependencies.push(parseDependency(dep));
      }
    }
  }

  return { name, version, description, targets, dependencies };
}

export function readApmManifest(cwd: string): ApmManifest | null {
  const manifestPath = path.join(cwd, "apm.yml");
  if (!fs.existsSync(manifestPath)) {
    return null;
  }
  const content = fs.readFileSync(manifestPath, "utf8");
  return parseApmManifest(content);
}

export function writeApmManifest(cwd: string, manifest: ApmManifest): void {
  const manifestPath = path.join(cwd, "apm.yml");
  const doc: Record<string, unknown> = {
    name: manifest.name,
    version: manifest.version,
  };
  if (manifest.description) {
    doc.description = manifest.description;
  }
  if (manifest.targets && manifest.targets.length > 0) {
    doc.target = manifest.targets;
  }
  if (manifest.dependencies.length > 0) {
    doc.dependencies = {
      apm: manifest.dependencies.map((d) => d.raw),
    };
  }
  fs.writeFileSync(manifestPath, stringifyYaml(doc));
}

export function dependencyToSourceString(dep: ApmDependency): string {
  return dep.source;
}

export function apmTargetsToAgents(targets: string[] | undefined): AgentName[] | undefined {
  if (!targets || targets.length === 0) {
    return undefined;
  }

  const result = new Set<AgentName>();
  for (const target of targets) {
    if (target === "all") {
      return [...KNOWN_AGENTS];
    }
    if (target === "minimal") {
      return undefined;
    }
    if (KNOWN_AGENTS.includes(target as AgentName)) {
      result.add(target as AgentName);
    }
    // Unsupported targets (copilot, gemini, kiro, vscode, agents, etc.) are silently ignored.
  }

  return [...result].sort((a, b) => a.localeCompare(b));
}

export function addDependencyToManifest(manifest: ApmManifest, source: string): boolean {
  const exists = manifest.dependencies.some((dep) => dep.source === source);
  if (exists) {
    return false;
  }
  manifest.dependencies.push({ source, raw: source });
  return true;
}

function parseTargets(doc: Record<string, unknown>): string[] | undefined {
  const target = doc.target ?? doc.targets;
  if (!target) {
    return undefined;
  }
  if (typeof target === "string") {
    return [target];
  }
  if (Array.isArray(target)) {
    return target.filter((t): t is string => typeof t === "string");
  }
  throw new ApmManifestError("`target` must be a string or list of strings");
}

function parseDependency(raw: unknown): ApmDependency {
  if (typeof raw === "string") {
    return { source: raw, raw };
  }

  if (!isPlainObject(raw)) {
    throw new ApmManifestError("Dependency must be a string or object");
  }

  const git = readOptionalString(raw, "git");
  const depPath = readOptionalString(raw, "path");
  const ref = readOptionalString(raw, "ref");

  if (git) {
    let source = git;
    if (ref && depPath) {
      source = `${git}#${ref}:${depPath}`;
    } else if (ref) {
      source = `${git}#${ref}`;
    } else if (depPath) {
      source = `${git}#:${depPath}`;
    }
    return { source, raw };
  }

  if (depPath) {
    return { source: depPath, raw };
  }

  throw new ApmManifestError("Dependency object must have `git` or `path` field");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readRequiredString(obj: Record<string, unknown>, key: string): string {
  const value = obj[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApmManifestError(`Missing required field: ${key}`);
  }
  return value;
}

function readOptionalString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }
  return value;
}

function readOptionalObject(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = obj[key];
  if (!isPlainObject(value)) {
    return undefined;
  }
  return value;
}

function readOptionalArray(obj: Record<string, unknown>, key: string): unknown[] | undefined {
  const value = obj[key];
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value;
}
