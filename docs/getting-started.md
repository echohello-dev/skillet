# Getting Started

This guide takes you from zero to your first `sklt install` in about five minutes.

## 1. Install `sklt`

Pick the install method that matches your platform. The package name is `sklt`.

### macOS / Linux (recommended)

```bash
curl -sSL https://echohello.dev/sklt/install.sh | sh
```

Or pick a specific channel:

| Channel | Command | Notes |
| --- | --- | --- |
| **Homebrew** | `brew install echohello-dev/tap/sklt` | macOS, Linuxbrew |
| **npm** | `npm i -g sklt` or use `npx sklt` | Node 20+ |
| **Direct binary** | Download from [GitHub Releases](https://github.com/echohello-dev/skillet/releases) | Single static binary, no runtime |

### Windows

```powershell
irm https://echohello.dev/sklt/install.ps1 | iex
```

| Channel | Command | Notes |
| --- | --- | --- |
| **winget** | `winget install echohello-dev.sklt` | Windows 10+ |
| **Chocolatey** | `choco install sklt` | |
| **npm** | `npm i -g sklt` | Node 20+ |

### Container

```bash
docker run --rm ghcr.io/echohello-dev/skillet --help
```

### Verify

```bash
sklt --version
# sklt/1.0.0 (commit=..., builtAt=..., target=...)
```

## 2. Start a project

Create a new project directory and scaffold a manifest:

```bash
mkdir my-agent-skills && cd my-agent-skills
sklt init
```

This writes an `apm.yml` manifest declaring your project. Open it — it looks like this:

```yaml
name: my-agent-skills
version: 0.1.0
description: Skills for my AI agent.
dependencies:
  apm: []
```

The format is [OpenAPM v0.1](https://microsoft.github.io/apm/reference/manifest-schema/) — Skillet is a conforming resolver. See [Usage](./usage.md) for the full schema.

## 3. Add your first skill

Point Skillet at any source that contains `SKILL.md` files:

```bash
# GitHub repo (uses git shorthand: owner/repo)
sklt add anthropics/skills

# Specific branch or tag
sklt add anthropics/skills#main

# OCI artifact from a registry
sklt add oci://ghcr.io/echohello-dev/frontend-design:v1

# Local directory
sklt add ../my-local-skills
```

`sklt add` resolves the source, discovers the skills inside it, and deploys them into your agent directory. By default it writes to whichever agent directory it finds (`.claude/skills`, `.codex/skills`, etc.). If none is found, it prompts you.

The source is appended to `apm.yml` so your install is reproducible.

## 4. Declare and install from a manifest

For reproducible installs across machines, commit an `apm.yml` and run:

```bash
sklt install
```

This reads every entry under `dependencies.apm` and installs it. No arguments required — `apm.yml` is the source of truth.

A realistic `apm.yml` for a team project:

```yaml
name: my-agent-skills
version: 1.0.0
target: claude
dependencies:
  apm:
    - anthropics/skills/skills/frontend-design
    - git: https://gitlab.internal.acme.com/platform/coding-standards.git
      ref: v2.0
    - oci://ghcr.io/acme/security-checklist:v1.2.0
    - ./team-internal
```

See [Usage](./usage.md#manifest-format) for the full schema and source formats.

## 5. Verify

List the skills Skillet discovered in your project:

```bash
sklt find
```

Or search by keyword:

```bash
sklt find deploy
```

Inspect the lockfile (`skillet.lock.yaml`) to see what's installed, where it came from, and how it was placed:

```bash
cat skillet.lock.yaml
```

## 6. Update

When you want to refresh sources, edit the refs in `apm.yml` and re-run `sklt install`. For automated detection of newer refs:

```bash
sklt check    # show what would change
sklt update   # refresh refs and reinstall
```

(`check` and `update` are in-progress; today, bump refs in `apm.yml` manually and re-run `sklt install`.)

## 7. Iterate

Author a new skill in your project:

```bash
sklt init skills/team-voice
```

This scaffolds `skills/team-voice/SKILL.md` with the required frontmatter (`name`, `description`). Edit the body to define when the skill should trigger and what the agent should do.

## Next steps

- Read [Usage](./usage.md) for the full command reference, manifest schema, and source format details.
- Read the [APM Manifest ADR](./adr/0001-apm-manifest-compliance.md) to understand which OpenAPM fields Skillet supports and which it intentionally ignores.
- Read [OCI Artifact Spec](../README.md#oci-artifact-spec) if you want to publish your own signed skill artifacts.
