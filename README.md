<div align="center">

```
     _    _ _ _      _   
 ___| | _(_) | | ___| |_ 
/ __| |/ / | | |/ _ \ __|
\__ \   <| | | |  __/ |_ 
|___/_|\_\_|_|_|\___|\__|
                        
```

**Portable CLI for managing agent skills. Single static binary, OpenAPM-compatible manifests, OCI-native artifacts.**

[Quick Start](#quick-start) · [Commands](#commands) · [Manifest](#manifest) · [Roadmap](#roadmap) · [Docs](#documentation)

|         |                                                                                                                                                                                                                              |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CI/CD   | [![CI](https://github.com/echohello-dev/skillet/actions/workflows/ci.yaml/badge.svg)](https://github.com/echohello-dev/skillet/actions) [![Release](https://github.com/echohello-dev/skillet/actions/workflows/release-please.yaml/badge.svg)](https://github.com/echohello-dev/skillet/releases) |
| Package | [![npm](https://img.shields.io/npm/v/getskillet?color=blue)](https://www.npmjs.com/package/getskillet) [![npm (scoped)](https://img.shields.io/npm/v/@echohello/skillet?color=blue)](https://www.npmjs.com/package/@echohello/skillet) [![Docker](https://img.shields.io/badge/ghcr.io-echohello--dev%2Fskillet-blue)](https://ghcr.io/echohello-dev/skillet) |
| Meta    | [![License: MIT](https://img.shields.io/github/license/echohello-dev/skillet?color=blue)](LICENSE) [![Node 20+](https://img.shields.io/badge/node-20%2B-339933)](https://nodejs.org) [![Bun 1.2](https://img.shields.io/badge/bun-1.2-f9f1e1)](https://bun.sh) |

</div>

## What this is

Skillet is a single-binary CLI that installs, discovers, and updates `SKILL.md`-based skills across Claude Code, Codex, OpenCode, Cursor, and Windsurf. It reads the [OpenAPM v0.1](https://microsoft.github.io/apm/reference/manifest-schema/) manifest format, ships skills as signed OCI artifacts, and links them into agent directories with one command.

Every install method produces the same `skillet` binary. `sklt` is a shorthand alias (both names point to the same CLI).

## Quick Start

Install:

```bash
# npm (Node 20+, works everywhere)
npm i -g getskillet

# macOS / Linux
brew install echohello-dev/tap/skillet

# Windows
winget install echohello-dev.skillet

# Container (no install)
docker run --rm ghcr.io/echohello-dev/skillet --help
```

Run it:

```bash
$ skillet --help
skillet/1.1.0

Usage:
  $ skillet <command> [options]

Commands:
  add [...args]            Install skills from a source
  find [...args]           Search available skills
  check [...args]          Check for updates to installed skills
  update [...args]         Update installed skills
  init [...args]           Create a SKILL.md template
  install [...args]        Install dependencies from apm.yml
  generate-lock [...args]  Generate skillet.lock.yaml

Options:
  -y, --yes      Skip confirmations
  --verbose      Enable verbose output
  -v, --version  Display version number
  -h, --help     Display this message
```

Scaffold a project, add a skill, install everything in the manifest:

```bash
$ mkdir my-agent-skills && cd my-agent-skills
$ skillet init
Created ./SKILL.md

$ skillet add anthropics/skills --skill frontend-design
Resolved anthropics/skills@4a7c1b6 (HEAD)
Linked frontend-design → .claude/skills/frontend-design

$ skillet find
name                description                                              path
frontend-design     Creates distinctive, production-grade frontend ...        .claude/skills/frontend-design
```

The CLI works the same whether invoked as `skillet` or `sklt`. See [docs/getting-started.md](./docs/getting-started.md) for the full install matrix.

## Features

|                 | Skill discovery | `apm.yml` install | OCI artifacts | Lockfile | Static binary | Multi-agent |
| --------------- | --------------- | ----------------- | ------------- | -------- | ------------- | ----------- |
| **Skills.sh**   | yes             | no                | no            | no       | no            | no          |
| **APM CLI**     | partial         | yes               | no            | partial  | no            | yes         |
| **Vercel CLI**  | no              | no                | no            | no       | partial       | yes         |
| **Skillet**     | yes             | yes               | yes           | yes      | yes           | yes         |

| Built on                | Purpose                                                              |
| ----------------------- | -------------------------------------------------------------------- |
| Bun runtime             | Source execution and bundling                                       |
| TypeScript              | Implementation language                                             |
| cac                     | CLI argument parsing                                                 |
| OpenAPM v0.1 schema     | `apm.yml` manifest format (skills-only profile)                      |
| OCI distribution spec   | `oci://` skill artifact publishing                                   |
| release-please          | Versioning, changelog, GitHub releases                               |

## Commands

| Command                       | Description                                                |
| ----------------------------- | ---------------------------------------------------------- |
| `skillet init [dir]`          | Scaffold a new `SKILL.md` with required frontmatter        |
| `skillet add <source>`        | Install skills from a source into the agent directory     |
| `skillet install`             | Install every dependency declared in `apm.yml`             |
| `skillet find [query]`        | Search discovered local skills                             |
| `skillet check`               | Detect upstream changes (in progress)                      |
| `skillet update`              | Refresh refs and reinstall (in progress)                   |
| `skillet generate-lock`       | Regenerate `skillet.lock.yaml` from disk                   |

All commands also work with the `sklt` shorthand alias (`sklt find`, `sklt init`, etc.).

## Manifest

`apm.yml` is the source of truth for `skillet install`. Skillet is a scoped conforming resolver for [OpenAPM v0.1](https://microsoft.github.io/apm/reference/manifest-schema/), with a skills-only profile.

```yaml
name: my-agent-skills
version: 1.0.0
target: [claude, codex, opencode, cursor]
dependencies:
  apm:
    - anthropics/skills/skills/frontend-design
    - github: git@gitlab.internal.acme.com/platform/coding-standards.git
      ref: v2.0
      path: skills/security
    - oci://ghcr.io/acme/security-checklist:v1.2.0
    - ./team-internal
```

Honored fields: `name`, `version`, `description`, `target` / `targets`, `dependencies.apm`. Unknown keys (including `dependencies.mcp`, `dependencies.lsp`, `hooks`, `plugins`, `marketplace`) are ignored per the OpenAPM spec. See [docs/adr/0001-apm-manifest-compliance.md](./docs/adr/0001-apm-manifest-compliance.md) for the rationale.

## Source formats

| Pattern                              | Resolved as                                                |
| ------------------------------------ | ---------------------------------------------------------- |
| `owner/repo`                         | GitHub shorthand, HEAD ref                                 |
| `owner/repo#v1.0.0`                  | GitHub shorthand, pinned ref (branch, tag, or SHA)         |
| `https://...` or `git@...`           | Full git URL                                               |
| `oci://registry/repo:tag`            | OCI artifact by tag (resolved to digest in lockfile)       |
| `oci://registry/repo@sha256:...`     | OCI artifact by digest                                     |
| `https://.../file.{zip,tar.gz,tgz}`  | HTTP archive (size and path-traversal validated)           |
| `./path`, `../path`, `~/path`        | Local directory                                            |

HTTP archives are rejected if they exceed size limits or contain path traversal entries. OCI artifacts must use artifact type `application/vnd.skillet.skill.v1+tar`.

## Supported agents

| Agent         | Project scope        | Global scope           |
| ------------- | -------------------- | ---------------------- |
| Claude Code   | `.claude/skills`     | `~/.claude/skills`     |
| Codex         | `.codex/skills`      | `~/.codex/skills`      |
| OpenCode      | `.opencode/skills`   | `~/.opencode/skills`   |
| Cursor        | `.cursor/skills`     | `~/.cursor/skills`     |
| Windsurf      | `.windsurf/skills`   | `~/.windsurf/skills`   |

APM `target:` and `targets:` values map to these names. Unknown targets are silently ignored.

## Architecture

```
                apm.yml
                  |
                  v
        +-------------------+
        |   skillet CLI     |
        |  (single binary)  |
        +-------------------+
                  |
   +--------------+--------------+--------------+
   |              |              |              |
   v              v              v              v
+---------+ +-----------+ +-------------+ +-----------+
|  git    | |   OCI     | |   HTTP      | |  local    |
| resolver| | resolver  | |  archive    | |  dir      |
+---------+ +-----------+ +-------------+ +-----------+
                  |
                  v
       +---------------------+
       |  per-agent skill    |
       |  directories        |
       |  (.claude, .codex,  |
       |   .opencode, ...)   |
       +---------------------+
                  |
                  v
       skillet.lock.yaml  (deterministic, sorted)
```

Skillet ships as one static binary per target (Linux x64/arm64 musl, macOS x64/arm64, Windows x64). No Python, no Node runtime for native installs. Symlinks point each skill into the agent directory; edits to a skill in your repo appear immediately in the agent without reinstall.

## Philosophy

1. **Manifest-driven.** Reproducible installs are the baseline. `apm.yml` is the contract.
2. **Standards over invention.** Conform to OpenAPM where it works. Ignore what doesn't apply.
3. **OCI-native artifacts.** Signed, addressable, air-gappable. No custom registry protocol.
4. **Symlink-first.** Source of truth is your repo, not the agent directory. Edit and reload.
5. **Single binary.** Drop into CI runners, locked-down endpoints, scratch containers.
6. **Skills only.** MCP servers, plugins, hooks, and LSP configs are out of scope. Skillet does one thing.

## Roadmap

| Bucket   | Item                                                               |
| -------- | ------------------------------------------------------------------ |
| Shipped  | `init`, `add`, `install`, `find`, `generate-lock`                  |
| Shipped  | OpenAPM v0.1 manifest support (skills-only profile)                |
| Shipped  | OCI artifact publishing with artifact-type `vnd.skillet.skill.v1`  |
| Shipped  | Multi-agent targets (Claude, Codex, OpenCode, Cursor, Windsurf)     |
| Shipped  | `getskillet` and `@echohello/skillet` npm distribution             |
| Shipped  | Homebrew / winget / Chocolatey / Docker / static binary distribution |
| Shipped  | npm Trusted Publishers (OIDC, no long-lived token)                 |
| Next     | `check` and `update` with ref-change detection                    |
| Next     | `--frozen` CI mode for `install`                                  |
| Next     | Signed commits and supply-chain attestations                       |
| Long-term | Lockfile spec compatibility with `apm.lock.yaml` (ADR-0002)       |
| Long-term | Multi-agent lockfile groups with per-agent source sets             |

## Documentation

| Topic                          | Doc                                                                   |
| ------------------------------ | --------------------------------------------------------------------- |
| Install and first project      | [docs/getting-started.md](./docs/getting-started.md)                  |
| Command reference              | [docs/usage.md](./docs/usage.md)                                     |
| OpenAPM conformance rationale  | [docs/adr/0001-apm-manifest-compliance.md](./docs/adr/0001-apm-manifest-compliance.md) |
| Vercel CLI parity notes        | [docs/parity/2026-02-20-vercel-cli-parity.md](./docs/parity/2026-02-20-vercel-cli-parity.md) |

| Distribution channel           | Doc                                              |
| ------------------------------ | ------------------------------------------------ |
| npm                            | [docs/distribution/npm.md](./docs/distribution/npm.md) |
| Homebrew                       | [docs/distribution/homebrew.md](./docs/distribution/homebrew.md) |
| Chocolatey                     | [docs/distribution/chocolatey.md](./docs/distribution/chocolatey.md) |
| winget                         | [docs/distribution/winget.md](./docs/distribution/winget.md) |
| Docker                         | [docs/distribution/docker.md](./docs/distribution/docker.md) |

## Development

```bash
mise run install     # install dependencies
mise run test        # run vitest (21 files, 103 tests)
mise run ci          # test + npm publish dry-run
mise run dev -- --help
```

Project conventions live in `AGENTS.md`. Architecture decisions are in `docs/adr/`.

## Project status

Stable. The `init`, `add`, `install`, `find`, and `generate-lock` commands are production-ready and the public API is stable. `check` and `update` are implemented behind feature flags and will land in the next minor release.

## License

MIT. See [LICENSE](LICENSE).

Built with Bun and TypeScript. CI runs on GitHub Actions. Published to npm, Homebrew, Chocolatey, winget, and ghcr.io.

[![Star History](https://api.star-history.com/svg?repos=echohello-dev/skillet&type=Date)](https://star-history.com/#echohello-dev/skillet&Date)
