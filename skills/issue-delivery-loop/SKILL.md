---
name: issue-delivery-loop
description: Use when executing GitHub issues end-to-end and you need a consistent flow for scoping, verification, merge readiness, and closure.
compatibility: Designed for CLI-based development workflows.
---

# Issue Delivery Loop

Use this skill to keep issue execution predictable, reviewable, and complete.

## When to Use

- You are implementing or fixing behavior tied to one or more issues.
- The request requires verified outcomes, not just code changes.
- You need to keep PR and issue status synchronized.

## Core Flow

1. **Scope the issue**
   - Capture objective, acceptance criteria, and dependencies.
   - Decide whether the issue can be completed independently.

2. **Deliver in a dedicated branch**
   - Keep changes scoped to the issue.
   - Avoid mixing unrelated work.

3. **Verify before merge**
   - Run project-standard validation commands.
   - Confirm expected behavior and no regressions.

4. **Close the feedback loop**
   - Open a linked PR with concise verification evidence.
   - Merge only after required checks pass.
   - Confirm the issue is closed and traceable to the merged work.

## Guardrails

- Do not claim completion without fresh verification evidence.
- Keep progress visible with short milestone updates.
- Prefer clear, factual summaries over narrative detail.
