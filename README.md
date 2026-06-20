# Skillet

Portable CLI for managing agent skills.

Skillet installs, discovers, and updates `SKILL.md`-based skills across Claude Code, Codex, OpenCode, Cursor, and Windsurf.

## Why Skillet

- **Manifest-driven** — declare your skills in `apm.yml` and `sklt install` reproduces the tree on any machine.
- **OpenAPM-compatible** — `apm.yml` conforms to the [OpenAPM v0.1](https://microsoft.github.io/apm/reference/manifest-schema/) spec, with a focused skills-only profile.
- **OCI-native** — publish and consume skills as signed `oci://` artifacts. Air-gapped, provenance-friendly, enterprise-ready.
- **Single static binary** — no Python runtime, no Node dependency for native installs. Drops into CI runners, Docker images, and locked-down endpoints.
- **Symlink-first** — edit a skill in your repo, see it live in the agent immediately. No reinstall dance.

## Install

```bash
# npm / npx (any platform with Node 20+)
npm i -g sklt
npx sklt --help

# macOS / Linux (Homebrew)
brew install echohello-dev/tap/sklt

# Windows (winget)
winget install echohello-dev.sklt

# Container
docker run --rm ghcr.io/echohello-dev/skillet --help

# Static binary — download from GitHub Releases
# https://github.com/echohello-dev/skillet/releases
```

All install methods ship the same `sklt` binary. See [docs/getting-started.md](./docs/getting-started.md) for the full install matrix and per-platform notes.

## Quick start

```bash
# Scaffold an apm.yml in your project
mkdir my-agent-skills && cd my-agent-skills
sklt init

# Add a skill from any supported source
sklt add anthropics/skills

# Or declare everything up front and install in one shot
echo 'dependencies:
  apm:
    - anthropics/skills/skills/frontend-design
    - oci://ghcr.io/your-org/team-skills:v1' >> apm.yml
sklt install

# Verify what's on disk
sklt find
```

See [docs/usage.md](./docs/usage.md) for the full command reference, manifest schema, and source format guide.

## Commands

| Command | Description |
| --- | --- |
| `sklt find [query]` | Search discovered local skills |
| `sklt init [dir]` | Scaffold a `SKILL.md` |
| `sklt add <source>` | Install skills from a source |
| `sklt install` | Install every dependency in `apm.yml` |
| `sklt check` | *(in progress)* Detect upstream changes |
| `sklt update` | *(in progress)* Refresh refs and reinstall |
| `sklt generate-lock` | Regenerate `skillet.lock.yaml` from disk |

Run `sklt --help` for the full list.

## Source formats

Skillet resolves any of these as a `sklt add` or `apm.yml` source:

- **Git** — `owner/repo`, `owner/repo#v1.0.0`, full `https://` or `git@` URLs
- **OCI** — `oci://registry/repository:tag` or `oci://registry/repository@sha256:<digest>`
- **HTTP archive** — `.zip`, `.tar.gz`, `.tgz` (with traversal and size safety checks)
- **Local** — `./path`, `../path`, `/abs/path`

See [docs/usage.md#source-formats](./docs/usage.md#source-formats) for details.

## Supported agents

| Agent | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills` | `~/.claude/skills` |
| Codex | `.codex/skills` | `~/.codex/skills` |
| OpenCode | `.opencode/skills` | `~/.opencode/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |
| Windsurf | `.windsurf/skills` | `~/.windsurf/skills` |

APM `target:` and `targets:` values map to these names. Unknown targets (e.g. `gemini`, `kiro`, `copilot`) are silently ignored — Skillet is skills-only.

## OCI artifact spec

`oci://` artifacts must use:

- **Artifact type:** `application/vnd.skillet.skill.v1+tar`
- **At least one tar layer** containing a single skill directory with `SKILL.md`
- **Safe extraction** — no path traversal

Tag-based refs are resolved to a manifest digest and recorded in `skillet.lock.yaml` for reproducibility.

Publishing example (conceptual):

```bash
tar -cf skill.tar <skill-dir>
oras push ghcr.io/<org>/<skill>:v1 \
  --artifact-type application/vnd.skillet.skill.v1+tar \
  skill.tar:application/vnd.oci.image.layer.v1.tar
```

## Development

```bash
mise run install     # install dependencies
mise run test        # run vitest
mise run ci          # test + npm publish dry-run
mise run dev -- --help
```

Project conventions live in `AGENTS.md`. Architecture decisions are in `docs/adr/`.

## Documentation

- [Getting Started](./docs/getting-started.md) — install and first project
- [Usage](./docs/usage.md) — command reference, manifest schema, source formats
- [Parity: Vercel CLI](./docs/parity/2026-02-20-vercel-cli-parity.md)
- [ADR-0001: APM Manifest Compliance](./docs/adr/0001-apm-manifest-compliance.md)

Distribution channels:

- [Homebrew](./docs/distribution/homebrew.md)
- [Chocolatey](./docs/distribution/chocolatey.md)
- [winget](./docs/distribution/winget.md)
- [Docker](./docs/distribution/docker.md)
- [npm](./docs/distribution/npm.md)
