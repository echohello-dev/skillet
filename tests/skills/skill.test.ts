import { describe, expect, test } from "vitest";
import { parseSkillMarkdown, SkillParseError } from "../../src/skills/skill";

const VALID_SKILL = `---
name: sample-skill
description: Sample skill for testing.
license: MIT
compatibility: Works anywhere.
metadata:
  author: skillet
  internal: false
allowed-tools: Bash Read
---

# Sample Skill

Hello world.
`;

describe("parseSkillMarkdown", () => {
  test("parses valid frontmatter and body", () => {
    const result = parseSkillMarkdown(VALID_SKILL, { expectedName: "sample-skill" });

    expect(result.frontmatter.name).toBe("sample-skill");
    expect(result.frontmatter.description).toBe("Sample skill for testing.");
    expect(result.frontmatter.license).toBe("MIT");
    expect(result.frontmatter.compatibility).toBe("Works anywhere.");
    expect(result.frontmatter.allowedTools).toBe("Bash Read");
    expect(result.frontmatter.metadata?.author).toBe("skillet");
    expect(result.isInternal).toBe(false);
    expect(result.body).toContain("# Sample Skill");
  });

  test("requires frontmatter", () => {
    expect(() => parseSkillMarkdown("# Missing frontmatter"))
      .toThrowError(SkillParseError);
  });

  test("validates name rules", () => {
    const invalidName = VALID_SKILL.replace("sample-skill", "InvalidName");

    expect(() => parseSkillMarkdown(invalidName)).toThrowError(
      "name must be lowercase alphanumeric with optional single hyphens"
    );
  });

  test("enforces directory name match when provided", () => {
    expect(() => parseSkillMarkdown(VALID_SKILL, { expectedName: "other" }))
      .toThrowError("name must match parent directory (other)");
  });

  test("requires description length constraints", () => {
    const tooLong = "a".repeat(1025);
    const text = VALID_SKILL.replace(
      "description: Sample skill for testing.",
      `description: ${tooLong}`
    );

    expect(() => parseSkillMarkdown(text)).toThrowError(
      "description must be 1-1024 characters"
    );
  });

  test("validates metadata types", () => {
    const invalidMetadata = VALID_SKILL.replace(
      "author: skillet",
      "author: 123"
    );

    expect(() => parseSkillMarkdown(invalidMetadata)).toThrowError(
      "metadata.author must be a string"
    );
  });

  test("validates metadata.internal boolean", () => {
    const invalidInternal = VALID_SKILL.replace("internal: false", "internal: yes");

    expect(() => parseSkillMarkdown(invalidInternal)).toThrowError(
      "metadata.internal must be a boolean"
    );
  });

  test("rejects conflicting allowed tools fields", () => {
    const conflicting = VALID_SKILL.replace(
      "allowed-tools: Bash Read",
      "allowed-tools: Bash Read\nallowedTools: Read"
    );

    expect(() => parseSkillMarkdown(conflicting)).toThrowError(
      "Use only one of allowedTools or allowed-tools"
    );
  });

  test("validates compatibility length", () => {
    const tooLong = "b".repeat(501);
    const text = VALID_SKILL.replace(
      "compatibility: Works anywhere.",
      `compatibility: ${tooLong}`
    );

    expect(() => parseSkillMarkdown(text)).toThrowError(
      "compatibility must be 1-500 characters"
    );
  });
});
