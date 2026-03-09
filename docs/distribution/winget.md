# winget Distribution

Skillet ships a winget manifest set for Windows installs.

## Release Flow

1. Build Windows artifact and checksums.
2. Render `packaging/winget/<version>/` from `SHA256SUMS`.
3. Validate manifests with `winget validate`.
4. Submit manifests to [`microsoft/winget-pkgs`](https://github.com/microsoft/winget-pkgs).

The release workflow also attaches the Windows binary and `SHA256SUMS` to the matching GitHub release, which gives winget a stable download source.

## Commands

```bash
mise run build -- --targets=windows-x64
bun scripts/write-checksums.ts
mise run render-winget-manifest -- --version <version>
```

Validation and install checks (Windows):

```powershell
winget validate packaging/winget/<version>/echohello-dev.skillet.yaml
winget install echohello-dev.skillet
```
