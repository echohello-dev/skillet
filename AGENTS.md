# AGENTS

- Use mise for running tasks and managing tool versions (see `.mise.toml`).
- Install dependencies with `mise run install`.
- Run the CLI in development with `mise run dev`.
- Run tests and CI with `mise run test` and `mise run ci`.
- Keep dependencies lightweight; avoid bloated CLI frameworks.
- Lockfile format is YAML (`skillet.lock.yaml`).
- Keep instructions concise and update this file when workflows change.
