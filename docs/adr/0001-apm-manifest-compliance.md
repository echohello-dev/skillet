---
number: 0001
date: 2026-06-20
raising_team: echohello-dev
prepared_by: codex@echohello.dev
status: accepted
---

# 0001. Adopt APM Manifest Compliance with Scoped Profile

## Context

Microsoft APM (Agent Package Manager) has published the OpenAPM v0.1 specification with a formal JSON Schema for `apm.yml`. The spec explicitly invites third-party conforming resolvers. APM is gaining traction as the de facto dependency manager for agent skills, prompts, and MCP servers across Claude, Copilot, Cursor, OpenCode, Codex, Gemini, and Windsurf.

Skillet (`sklt`) was built as a lightweight, skills-only resolver with unique support for OCI artifacts and single-binary distribution. Until now it had no manifest format — installations were purely CLI-driven (`sklt add <source>`). This creates friction for teams who want reproducible, version-pinned skill trees checked into source control.

We evaluated three paths:
1. **Invent `skillet.yml`** — own format, own ecosystem, full control.
2. **Become an APM-conforming resolver** — read/write `apm.yml`, interoperate with the growing APM ecosystem.
3. **Hybrid** — support both formats.

## Decision

Adopt **Path 2: APM-conforming resolver with a scoped profile**.

- Skillet reads and writes `apm.yml` as its primary manifest.
- Skillet resolves `dependencies.apm` entries (git, local, HTTP sources) and deploys skills into per-agent directories.
- Skillet **ignores** `mcp`, `lsp`, `hooks`, `commands`, `plugins`, `marketplace`, `compilation`, and `policy` blocks, surfacing a clear "not supported by sklt" notice when these are present. This aligns with the spec which permits resolvers to ignore unknown keys.
- Skillet **retains** `skillet.lock.yaml` as its lockfile format for now, with field names aligned to APM's lockfile spec where practical. A future ADR may adopt `apm.lock.yaml` directly.
- Skillet **adds** `sklt install` as the bare-install command (no arguments = install everything declared in `apm.yml`).
- `sklt add <source>` updates `apm.yml` when one exists, appending the source to `dependencies.apm`.

### Rationale

- **Ecosystem access:** Any repo with an `apm.yml` works with Skillet immediately.
- **Differentiation preserved:** OCI artifacts, single-binary distribution, and symlink-first installs remain unique to Skillet.
- **Reduced design burden:** We don't need to design, document, and evangelise a competing manifest format.
- **Future optionality:** If OpenAPM adds OCI in a future revision, we can propose it as a spec extension from a position of working implementation.

## Consequences

### Positive
- Instant compatibility with APM-authored packages and marketplaces.
- Teams can migrate between APM and Skillet without rewriting manifests.
- `sklt install` provides reproducible, manifest-driven workflows.
- Positions Skillet as "the lightweight, OCI-native APM resolver for skills-only workflows."

### Negative / trade-offs
- Must track a moving specification (OpenAPM v0.3 working draft).
- Scope is narrower than APM; some users may expect MCP/plugin support and be disappointed.
- Virtual-package shorthand (`owner/repo/path`) is not yet supported by our git resolver; object-form (`git` + `path`) must be used instead.

### Follow-ups
- ADR-0002: Evaluate adopting `apm.lock.yaml` directly vs keeping `skillet.lock.yaml`.
- Issue: Add virtual-package shorthand support to `src/resolvers/git.ts`.
- Issue: Implement `--frozen` CI mode for `sklt install`.
- Issue: Implement `--update` consent-gated ref refresh for `sklt install`.

## References
- https://microsoft.github.io/apm/reference/manifest-schema/
- https://microsoft.github.io/apm/reference/lockfile-spec/
- https://github.com/microsoft/apm/blob/main/manifest-v0.1.schema.json
- docs/parity/2026-02-20-vercel-cli-parity.md
