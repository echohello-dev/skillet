# Homebrew Distribution

Skillet ships a Homebrew formula for direct `brew install` on macOS.

## Release Flow

1. Build release artifacts and checksums.
2. Render `packaging/homebrew/skillet.rb` from checksums.
3. Publish GitHub release assets for the same version.
4. Push formula update to the tap repository.

## Commands

```bash
mise run build
bun scripts/write-checksums.ts
mise run render-homebrew-formula -- --version <version>
```

The renderer expects:

- `dist/skillet-darwin-arm64`
- `dist/skillet-darwin-x64`
- `dist/SHA256SUMS`

Install instructions for users:

```bash
brew tap echohello-dev/tap
brew install skillet
```
