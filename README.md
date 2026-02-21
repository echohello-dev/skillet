# Skillet

Portable CLI for managing agent skills.

Skillet installs, discovers, and updates `SKILL.md`-based skills across supported agent directories.

## Installation

| Method | Command / Source | Status |
| --- | --- | --- |
| Binary release | Download from GitHub Releases | Planned |
| Homebrew | `brew install skillet` | Configured |
| Chocolatey | `choco install skillet` | Configured |
| winget | `winget install skillet` | Configured |
| npm / npx | `npx skillet ...` | Configured |
| Docker | `docker run ... skillet ...` | Configured |
| Local dev | `mise run dev -- --help` | Available |

Current development workflow:

```bash
mise run install
mise run dev -- --help
```

## CLI Usage

```bash
skillet --help
skillet find [query]
skillet init [directory]
```

Implemented commands:
- `find`: search discovered local skills by name/description
- `init`: scaffold a valid `SKILL.md`
- `generate-lock`: deterministic `skillet.lock.yaml` generation from installed skills

In-progress commands:
- `add`
- `check`
- `update`

## Source Formats

Skillet supports these source formats for skill content:

- Git sources (owner/repo shorthand, HTTPS, `git@`, local repos)
- HTTP archives (`.zip`, `.tar.gz`) with traversal and size safety checks
- OCI artifacts (`oci://registry/repository:tag` or `@sha256:digest`)

## Compatibility Notes

Supported agent directory conventions:

- Project scope:
  - `.claude/skills`
  - `.codex/skills`
  - `.opencode/skills`
  - `.cursor/skills`
  - `.windsurf/skills`
- Global scope:
  - `~/.claude/skills`
  - `~/.codex/skills`
  - `~/.opencode/skills`
  - `~/.cursor/skills`
  - `~/.windsurf/skills`

Discovery behavior:

- Standard search locations include root + `skills/` variants
- Invalid `SKILL.md` files are skipped
- Recursive fallback search is only used when standard/agent locations are empty

## Lockfile

Skillet lockfile format is YAML (`skillet.lock.yaml`) with deterministic ordering.

Schema (v1):

```yaml
version: 1
sources:
  - type: git|oci|http|unknown
    url: <source-url>
    ref: <optional-ref>
    digest: <optional-digest>
    installMethod: symlink|copy
    skills:
      - <skill-name>
    agents:
      - <agent-id>
```

## OCI Artifact Spec

Skillet OCI resolver expects artifacts with:

- OCI reference format:
  - `oci://<registry>/<repo>:<tag>`
  - `oci://<registry>/<repo>@sha256:<digest>`
- Manifest requirements:
  - `artifactType: application/vnd.skillet.skill.v1+tar`
  - at least one tar layer
- Content requirements:
  - tar layer extracts safely (no path traversal)
  - artifact contains exactly one skill directory
  - skill contains `SKILL.md`

For tag-based references, Skillet records the resolved manifest digest for lock tracking.

## OCI Publishing Guidance

Recommended publishing flow:

1. Package one skill directory per artifact into a tar layer.
2. Publish with artifact type `application/vnd.skillet.skill.v1+tar`.
3. Push to registry (GHCR recommended first) with both tag and digest discoverability.
4. Install via:
   - `oci://ghcr.io/<org>/<skill>:<tag>`
   - `oci://ghcr.io/<org>/<skill>@sha256:<digest>`

Example (conceptual):

```bash
tar -cf skill.tar <skill-dir>
oras push ghcr.io/<org>/<skill>:v1 \
  --artifact-type application/vnd.skillet.skill.v1+tar \
  skill.tar:application/vnd.oci.image.layer.v1.tar
```

## Development

```bash
mise run install
mise run test
mise run ci
```

AGENTS instructions live in `AGENTS.md`.

Distribution docs:

- Homebrew: `docs/distribution/homebrew.md`
- Chocolatey: `docs/distribution/chocolatey.md`
- winget: `docs/distribution/winget.md`
- Docker: `docs/distribution/docker.md`
- npm: `docs/distribution/npm.md`
