# Vercel CLI Parity Review

Date: February 20, 2026
Compared against: `vercel-labs/skills` (default branch snapshot)

## Scope

Parity review covers:
- Command names
- Flags and defaults
- Output/help style

## Checklist

| Area | Vercel `skills` | `skillet` | Status | Notes |
| --- | --- | --- | --- | --- |
| Root commands | `add`, `find`, `check`, `update`, `init`, plus `remove/list` and experimental commands | `add`, `find`, `check`, `update`, `init`, `generate-lock` | Partial | Core command names align; `remove/list` and experimental commands are not implemented yet. |
| `find` behavior | Interactive search + keyword | Keyword search of discovered local skills | Partial | Intentional lightweight mode for now; no TUI. |
| `init` behavior | `init [name]` scaffolds `SKILL.md` | `init [dir]` scaffolds `SKILL.md` | Partial | Equivalent outcome; argument shape differs slightly. |
| `add` flags | `--agent`, `--skill`, `--list`, `--all`, `-g`, `-y`, `--copy`, etc. | Planned: `--agent`, `--skill`, `--list`, `--all`, `-g`, `-y` | Gap | `add` implementation still in progress (`#10`). |
| Global flags | `--help`, `--version` | `--help`, `--version`, plus `-y`, `--verbose` as global flags | Partial | `skillet` currently exposes `-y` globally for simpler routing. |
| Help/output style | Colorized, branded, long-form help | Minimal plain text help | Intentional difference | Kept minimal per project goal: lightweight CLI and predictable output. |

## Decisions

1. Keep lightweight output style (no branded/colorized output) as an intentional divergence.
2. Maintain core command name parity (`add/find/check/update/init`).
3. Complete flag-level parity during `add/check/update` implementation issues (`#10`, `#12`).
4. Revisit optional parity for `remove/list` after core install/update workflow is complete.

## Follow-up items

- `#10` Add command implementation and flag parity.
- `#12` Check/update command parity and behavior.
- Future: decide whether `remove/list` parity is required for v1.
