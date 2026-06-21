# Usage

Full reference for `skillet` commands, the `apm.yml` manifest, and supported source formats.

**Binary naming:** every command below works with `skillet` (default) or `sklt` (shorthand alias). Both names point to the same binary.

## Commands

```bash
skillet --help            # show all commands
skillet --version         # print version + build metadata
```

### `skillet find [query]`

Search skills already discovered on the current machine.

```bash
skillet find                # list all discovered skills
skillet find deploy         # filter by name or description keyword
```

Discovers skills from project directories (`.claude/skills`, `.codex/skills`, `.opencode/skills`, `.cursor/skills`, `.windsurf/skills`) and global equivalents in `$HOME`. Invalid `SKILL.md` files are skipped.

### `skillet init [directory]`

Scaffold a new `SKILL.md` with the required frontmatter.

```bash
skillet init                       # scaffold ./SKILL.md
skillet init skills/team-voice     # scaffold skills/team-voice/SKILL.md
skillet init skills/team-voice -y  # overwrite if it exists
```

The scaffolded file contains:

```markdown
---
name: team-voice
description: Team voice description.
---

# Team Voice

Describe what this skill does and when to use it.
```

The directory name must be lowercase alphanumeric with optional hyphens (1–64 chars).

### `skillet add <source>`

Install skills from a single source.

```bash
skillet add owner/repo                          # GitHub shorthand
skillet add owner/repo#v1.2.0                   # pinned to a git ref
skillet add https://github.com/owner/repo.git   # full git URL
skillet add oci://ghcr.io/org/skill:v1          # OCI artifact
skillet add https://example.com/skills.zip     # HTTP archive
skillet add ./local-skills                      # local directory
```

Flags:

| Flag | Description |
| --- | --- |
| `--list`, `-l` | List skills in the source without installing |
| `--skill <name>`, `-s <name>` | Install only the named skill(s); repeatable, comma-separated |
| `--agent <name>`, `-a <name>` | Target agent(s); repeatable, comma-separated, or `*` for all |
| `--all` | Install every skill in the source (implies `--yes`) |
| `--copy` | Copy the skill into the agent dir instead of symlinking |
| `--global`, `-g` | Install to `~/.{agent}/skills` instead of `./.{agent}/skills` |
| `--yes`, `-y` | Skip confirmation prompts |

Examples:

```bash
# Preview what's available before installing
skillet add owner/repo --list

# Install a single skill from a multi-skill repo
skillet add owner/repo --skill frontend-design

# Install all skills to a specific agent
skillet add owner/repo --all --agent codex

# Copy instead of symlink (useful for system-managed agent dirs)
skillet add owner/repo --all --copy
```

If `apm.yml` exists in the current directory, `skillet add` appends the source to `dependencies.apm` (no duplicates).

### `skillet install`

Install every dependency declared in `apm.yml`. No arguments required.

```bash
skillet install
```

Resolves each `dependencies.apm` entry in declaration order and deploys the discovered skills to the target agent directory.

Target selection:
- If `apm.yml` declares `target:` or `targets:`, those are used.
- Otherwise, Skillet auto-detects which agent directories are present (`.claude/skills`, `.codex/skills`, etc.) and uses those.
- Use `--agent` to override:

```bash
skillet install --agent claude,cursor
```

Other flags:

| Flag | Description |
| --- | --- |
| `--dry-run` | Print the install plan without writing anything |

### `skillet check` (in progress)

Show which installed skills have newer refs available upstream.

### `skillet update` (in progress)

Refresh refs to the latest matching versions and reinstall.

### `skillet generate-lock`

Re-generate `skillet.lock.yaml` from the skills currently on disk. Useful if the lockfile gets out of sync with reality (e.g., manual edits).

## Manifest format (`apm.yml`)

`apm.yml` is the source of truth for `skillet install`. Skillet is a scoped conforming resolver for [OpenAPM v0.1](https://microsoft.github.io/apm/reference/manifest-schema/).

### Schema (supported subset)

```yaml
name: my-project              # REQUIRED, string
version: 1.0.0                # REQUIRED, semver string
description: ...              # optional, string
target: claude                # optional: string or list
                              #   "all" | "claude" | "codex" | "opencode"
                              #   "cursor" | "windsurf" | "minimal"
                              #   unsupported APM targets are silently ignored
dependencies:
  apm:                        # list of source entries
    - owner/repo              # string form (git, http, oci, local)
    - owner/repo#v1.0.0       # with ref
    - https://gitlab.com/x/y.git
    - oci://ghcr.io/org/skill:v1
    - ./local-skills
    -                         # object form
      git: https://gitlab.com/x/y.git
      ref: v1.0.0
      path: skills/security   # subdirectory within the repo
    - path: ./local-skill     # local-only object
```

### String form

| Pattern | Resolved as |
| --- | --- |
| `owner/repo` | GitHub shorthand, HEAD ref |
| `owner/repo#ref` | GitHub shorthand, pinned ref (branch, tag, or SHA) |
| `https://...` or `git@...` | Full git URL |
| `oci://registry/repo:tag` | OCI artifact |
| `oci://registry/repo@sha256:...` | OCI artifact by digest |
| `https://.../file.{zip,tar.gz,tgz}` | HTTP archive |
| `./path`, `../path`, `~/path`, `/abs/path` | Local directory |

### Object form

| Field | Use |
| --- | --- |
| `git` | Full git URL (HTTPS, SSH, or shorthand) |
| `ref` | Git ref: branch, tag, or commit SHA |
| `path` | Subdirectory within the repo (remote) or local path (no `git`) |
| `alias` | Local alias for the dep (not yet used for resolution) |

### Supported vs. ignored

Skillet honors `name`, `version`, `description`, `target`/`targets`, and `dependencies.apm`. It intentionally ignores (no error):

- `dependencies.mcp`, `dependencies.lsp` (out of scope: skills-only resolver)
- `scripts` (out of scope)
- `includes`, `registries`, `policy`, `compilation` (out of scope)
- `marketplace` (out of scope; Skillet is a consumer, not a publisher)
- `devDependencies` (out of scope)

Unknown top-level keys are ignored per the OpenAPM spec.

## Source formats

### Git

```bash
skillet add owner/repo
skillet add owner/repo#v2.0
skillet add git@github.com:owner/repo.git
skillet add https://gitlab.com/group/sub/repo.git
```

Clones to a temporary directory, checks out the ref, then symlinks skills into the target agent dir. Records the commit SHA in the lockfile for reproducibility.

### OCI

```bash
skillet add oci://ghcr.io/org/skill:v1
skillet add oci://ghcr.io/org/skill@sha256:abc123...
```

Published artifacts must use artifact type `application/vnd.skillet.skill.v1+tar` and contain a single tar layer. See the [OCI Artifact Spec](../README.md#oci-artifact-spec).

### HTTP archives

```bash
skillet add https://example.com/skills.zip
skillet add https://example.com/skills.tar.gz
```

Skillet validates that the archive is within size limits and contains no path traversal entries.

### Local directories

```bash
skillet add ./my-skills
skillet add /abs/path/to/skills
```

Searches the directory for `SKILL.md` files in standard locations (`./skills/`, subdirectories, or a recursive fallback).

## Lockfile

`skillet.lock.yaml` is generated after every `add` and `install`. Schema (v1):

```yaml
version: 1
sources:
  - type: git                # git | oci | http | unknown
    url: https://github.com/owner/repo.git
    ref: main
    digest: 4a7c1b6d9e2f8c0a3b5e7d2c1f0a8b9c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a
    installMethod: symlink    # symlink | copy
    skills:
      - frontend-design
    agents:
      - claude
```

Sources are grouped by `(type, url, ref, digest, installMethod)` and sorted deterministically for clean diffs.

## Supported agent directories

| Agent | Project scope | Global scope |
| --- | --- | --- |
| Claude Code | `.claude/skills` | `~/.claude/skills` |
| Codex | `.codex/skills` | `~/.codex/skills` |
| OpenCode | `.opencode/skills` | `~/.opencode/skills` |
| Cursor | `.cursor/skills` | `~/.cursor/skills` |
| Windsurf | `.windsurf/skills` | `~/.windsurf/skills` |

Use `--global` / `-g` to install to the user-scope directory.

## Workflow tips

**Dev loop:** use a local source and symlink installs.

```bash
skillet add ./my-skill --skill my-skill -y
# Edit ./my-skill/SKILL.md; the symlinked copy in .claude/skills/ updates immediately
```

**Pin everything:** use refs for reproducible CI installs.

```bash
# apm.yml
dependencies:
  apm:
    - github/action-skills#v1.2.3
    - oci://ghcr.io/org/standard-skills@sha256:9f0e...
```

**Multi-agent projects:** declare all targets.

```yaml
target: [claude, codex, opencode, cursor]
```

**Air-gapped installs:** mirror OCI artifacts to an internal registry, then point `apm.yml` at it.

```yaml
dependencies:
  apm:
    - oci://registry.internal.acme.com/team/skills:v1
```
