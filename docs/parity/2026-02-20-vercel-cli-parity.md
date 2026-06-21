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

## APM Manifest Parity (added 2026-06-20)

Compared against: [OpenAPM v0.1 manifest schema](https://microsoft.github.io/apm/reference/manifest-schema/)

| Area | APM | `skillet` | Status | Notes |
| --- | --- | --- | --- | --- |
| Manifest format | `apm.yml` | `apm.yml` (read/write) | **Accepted** | ADR-0001: adopt APM manifest with scoped profile. |
| `dependencies.apm` | String + object forms, git/local/HTTP/registry/marketplace | String + object forms, git/local/HTTP only | Partial | Registry and marketplace deps are not supported. |
| `dependencies.mcp` | Full MCP server management | Not supported | Intentional gap | Out of scope for skills-only resolver. |
| `dependencies.lsp` | LSP server entries | Not supported | Intentional gap | Out of scope. |
| `target` / `targets` | String or list, auto-detect | String or list, auto-detect | Partial | Only maps to Skillet's known agents; unsupported targets silently ignored. |
| `scripts` | Named shell commands | Not supported | Intentional gap | Out of scope. |
| `includes` | Auto or explicit path list | Not supported | Intentional gap | Out of scope. |
| `registries` | REST-based APM registries | Not supported | Gap | Could be added later; not on immediate roadmap. |
| `policy` | Consumer-side org policy | Not supported | Intentional gap | Out of scope. |
| `compilation` | `apm compile` settings | Not supported | Intentional gap | Out of scope. |
| `marketplace` | Marketplace authoring block | Not supported | Intentional gap | Out of scope. |
| `skillet install` | `apm install` equivalent | Implemented | Partial | No `--frozen`, `--update`, or transitive resolution yet. |
| Lockfile | `apm.lock.yaml` | `skillet.lock.yaml` | Partial | Field names aligned where practical; may adopt `apm.lock.yaml` in future ADR. |

## Decisions

1. Keep lightweight output style (no branded/colorized output) as an intentional divergence.
2. Maintain core command name parity (`add/find/check/update/init`).
3. Complete flag-level parity during `add/check/update` implementation issues (`#10`, `#12`).
4. Revisit optional parity for `remove/list` after core install/update workflow is complete.
5. **(NEW)** Adopt `apm.yml` as primary manifest per ADR-0001; scope to skills-only subset.

## Follow-up items

- `#10` Add command implementation and flag parity.
- `#12` Check/update command parity and behavior.
- Future: decide whether `remove/list` parity is required for v1.
- Future ADR: evaluate adopting `apm.lock.yaml` directly.
- Issue: add virtual-package shorthand (`owner/repo/path`) to git resolver.
