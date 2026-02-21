# Chocolatey Distribution

Skillet ships a Chocolatey package for Windows CLI installs.

## Release Flow

1. Build release artifacts and checksums.
2. Render `packaging/chocolatey/` from `SHA256SUMS`.
3. Build and push the `.nupkg` with `choco pack` and `choco push`.

## Commands

```bash
mise run build -- --targets=windows-x64
bun scripts/write-checksums.ts
mise run render-chocolatey-package -- --version <version>
```

Generate package and publish:

```powershell
cd packaging/chocolatey
choco pack
choco push skillet.<version>.nupkg --source https://push.chocolatey.org/
```

User install command:

```powershell
choco install skillet
```
