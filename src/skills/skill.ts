import path from "node:path";
import { parse as parseYaml } from "yaml";

export class SkillParseError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "SkillParseError";
    this.field = field;
  }
}

export type SkillFrontmatter = {
  name: string;
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string | boolean>;
  allowedTools?: string;
};

export type SkillFile = {
  frontmatter: SkillFrontmatter;
  body: string;
  isInternal: boolean;
};

const NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type ParseOptions = {
  path?: string;
  expectedName?: string;
};

export function parseSkillMarkdown(markdown: string, options: ParseOptions = {}): SkillFile {
  const { frontmatterText, body } = splitFrontmatter(markdown);
  const data = parseYaml(frontmatterText);

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new SkillParseError("Frontmatter must be a YAML object");
  }

  const record = data as Record<string, unknown>;
  const name = readStringField(record, "name", true);
  const description = readStringField(record, "description", true);
  const license = readStringField(record, "license");
  const compatibility = readStringField(record, "compatibility");
  const allowedTools = readAllowedTools(record);
  const metadata = normalizeMetadata(record.metadata);

  const expectedName = options.expectedName ?? deriveExpectedName(options.path);

  validateName(name, expectedName);
  validateDescription(description);
  validateCompatibility(compatibility);

  const frontmatter: SkillFrontmatter = {
    name,
    description,
    license,
    compatibility,
    metadata,
    allowedTools,
  };

  return {
    frontmatter,
    body,
    isInternal: metadata?.internal === true,
  };
}

function splitFrontmatter(markdown: string): { frontmatterText: string; body: string } {
  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== "---") {
    throw new SkillParseError("SKILL.md must start with frontmatter '---' delimiter");
  }

  let endIndex = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    throw new SkillParseError("SKILL.md frontmatter must be closed with '---' delimiter");
  }

  const frontmatterText = lines.slice(1, endIndex).join("\n");
  const body = lines.slice(endIndex + 1).join("\n");

  return { frontmatterText, body };
}

function readStringField(
  record: Record<string, unknown>,
  key: string,
  required = false
): string | undefined {
  const value = record[key];

  if (value === undefined || value === null) {
    if (required) {
      throw new SkillParseError(`Missing required field: ${key}`, key);
    }
    return undefined;
  }

  if (typeof value !== "string") {
    throw new SkillParseError(`Field ${key} must be a string`, key);
  }

  if (required && value.trim().length === 0) {
    throw new SkillParseError(`Field ${key} must not be empty`, key);
  }

  return value;
}

function readAllowedTools(record: Record<string, unknown>): string | undefined {
  const legacy = record.allowedTools;
  const dashed = record["allowed-tools"];

  if (legacy !== undefined && dashed !== undefined && legacy !== dashed) {
    throw new SkillParseError("Use only one of allowedTools or allowed-tools", "allowed-tools");
  }

  const value = dashed ?? legacy;
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new SkillParseError("allowed-tools must be a string", "allowed-tools");
  }

  return value;
}

function normalizeMetadata(metadata: unknown): Record<string, string | boolean> | undefined {
  if (metadata === undefined || metadata === null) {
    return undefined;
  }

  if (typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new SkillParseError("metadata must be a mapping", "metadata");
  }

  const record = metadata as Record<string, unknown>;
  const normalized: Record<string, string | boolean> = {};

  for (const [key, value] of Object.entries(record)) {
    if (key === "internal") {
      if (typeof value !== "boolean") {
        throw new SkillParseError("metadata.internal must be a boolean", "metadata.internal");
      }
      normalized[key] = value;
      continue;
    }

    if (typeof value !== "string") {
      throw new SkillParseError(`metadata.${key} must be a string`, `metadata.${key}`);
    }

    normalized[key] = value;
  }

  return normalized;
}

function validateName(name: string, expectedName?: string): void {
  if (name.length < 1 || name.length > 64) {
    throw new SkillParseError("name must be 1-64 characters", "name");
  }

  if (!NAME_PATTERN.test(name)) {
    throw new SkillParseError(
      "name must be lowercase alphanumeric with optional single hyphens",
      "name"
    );
  }

  if (expectedName && name !== expectedName) {
    throw new SkillParseError(
      `name must match parent directory (${expectedName})`,
      "name"
    );
  }
}

function validateDescription(description: string): void {
  if (description.length < 1 || description.length > 1024) {
    throw new SkillParseError("description must be 1-1024 characters", "description");
  }
}

function validateCompatibility(compatibility?: string): void {
  if (compatibility === undefined) {
    return;
  }

  if (compatibility.length < 1 || compatibility.length > 500) {
    throw new SkillParseError("compatibility must be 1-500 characters", "compatibility");
  }
}

function deriveExpectedName(filePath?: string): string | undefined {
  if (!filePath) {
    return undefined;
  }

  const dirName = path.basename(path.dirname(filePath));
  if (!dirName || dirName === path.sep) {
    return undefined;
  }

  return dirName;
}
