---
name: claude-complex-tasks
description: Guide Claude on complex, multi-step tasks by enforcing structured discovery, scoped planning, and verification before delivery.
compatibility: Designed for Claude Code and similar agents.
---

# Claude Complex Tasks

Use this skill when the task is complex, multi-step, or ambiguous and needs careful planning, validation, or staged delivery.

## When to Use

- The request spans multiple subsystems or files.
- The outcome depends on external constraints (CI, build, integrations).
- The task is risky, irreversible, or requires high accuracy.

## Approach

1. **Clarify scope**
   - Restate the goal in one sentence.
   - List assumptions and missing inputs.
   - Ask only one focused question if blocked.

2. **Plan the work**
   - Break into 3-7 steps with clear outcomes.
   - Identify dependencies (tools, files, environment).
   - Decide what can be done in parallel.

3. **Gather context**
   - Locate relevant files and read them first.
   - Verify conventions and existing patterns.
   - Identify edge cases and constraints.

4. **Execute in stages**
   - Make smallest safe change to prove direction.
   - Iterate with tests or quick checks.
   - Keep changes scoped to the request.

5. **Verify**
   - Run requested tests or minimal validation.
   - Confirm behavior against acceptance criteria.
   - Note any remaining risks.

6. **Report**
   - Summarize what changed and where.
   - Call out any decisions or tradeoffs.
   - Suggest next steps if needed.

## Output Expectations

- Prefer concise, structured updates.
- Avoid long dumps of code; reference files instead.
- Keep decisions explicit and traceable.
