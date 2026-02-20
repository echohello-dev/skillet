# AGENTS

## Tooling

- Use mise for running tasks and managing tool versions (see `.mise.toml`).
- Install dependencies with `mise run install`.
- Run the CLI in development with `mise run dev`.
- Run tests and CI with `mise run test` and `mise run ci`.
- Keep dependencies lightweight; avoid bloated CLI frameworks.
- Lockfile format is YAML (`skillet.lock.yaml`).

## Delivery Loop

- Work issues one at a time unless tasks are truly independent.
- Use a dedicated branch per issue: `codex/issue-<number>-<slug>`.
- Confirm issue scope and acceptance criteria before making changes.
- Prefer test-first changes for behavior updates and bug fixes.
- Verify locally before PR (`mise run ci` at minimum).
- Open PRs with clear summary, verification evidence, and `Fixes #<issue>` linkage.
- Merge only after required checks pass.
- Close the feedback loop: ensure issue is closed and results are visible in docs/changelog where relevant.

## Docs and Skills

- Keep guidance concise and action-oriented.
- Prefer process guidance over implementation detail in agent-facing docs.
- Update this file and project skills whenever workflow expectations change.
