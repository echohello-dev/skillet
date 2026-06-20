# npm Distribution

Skillet publishes an npm package named `getskillet` so users can run:

- `npx getskillet ...`
- `bunx getskillet ...`
- `npm i -g getskillet` then `sklt ...`

## Packaging Model

- `src/cli.ts` is bundled to `dist/npm/cli.js` targeting Node.
- `package.json` name is `getskillet`; the `bin` field exposes `sklt` pointing to `dist/npm/cli.js`.
- `prepack` rebuilds the npm CLI bundle automatically.

## Local Validation

```bash
mise run build-npm
npm pack
npx --yes --package ./getskillet-<version>.tgz sklt --help
bunx --bun --package ./getskillet-<version>.tgz sklt --help
mise run npm-publish-dry-run
```

## Publish

```bash
npm publish --access public
```

## GitHub Actions Publish

- Automatic publish runs from `.github/workflows/npm-publish.yaml` when a GitHub release is published.
- Manual publish is available through `workflow_dispatch`; provide an explicit git ref, usually a release tag like `v1.0.0`.
- Manual publish also supports a dry run so you can inspect the package contents without uploading to npm.
- `mise run ci` now includes the npm publish dry run so package publishing is validated in CI before release.
- **Uses npm Trusted Publishers** — no long-lived `NPM_TOKEN` secret required. The workflow uses GitHub OIDC (`id-token: write`) and `actions/setup-node`'s built-in OIDC support; npm verifies the workflow identity against the trusted publisher configured on the package.

### First-time setup (one-time, on npmjs.com)

1. **Create the package on npm** — either by publishing manually once (`npm publish --access public` from your local machine, or use the npm web UI to claim the name), or by triggering the workflow below in dry-run mode and then asking the maintainer to do a one-shot token publish.
2. **Configure the Trusted Publisher** on https://www.npmjs.com/package/getskillet/access:
   - **Publisher:** GitHub Actions
   - **Organization or user:** `echohello-dev`
   - **Repository:** `skillet`
   - **Workflow filename:** `npm-publish.yaml`
   - **Environment name:** *(leave blank)*
3. **Confirm the workflow file** at `.github/workflows/npm-publish.yaml` has `id-token: write` in its `permissions:` block (already set).

After this, all future `npm-publish` runs authenticate via OIDC — no token to rotate, leak, or steal.

Manual dispatch inputs:

- `ref`: tag, branch, or commit to publish
- `npm_tag`: npm dist-tag, defaults to `latest`
- `dry_run`: when true, runs `npm publish --dry-run` and skips the real publish step
- When `dry_run` is true, the workflow uses the provided `npm_tag`, or falls back to `dry-run` if you leave it at `latest`.

Local command:

- `mise run npm-publish-dry-run`: builds the npm CLI bundle and runs `npm publish --dry-run --tag dry-run`
- Override the dry-run tag if needed with `NPM_DIST_TAG=<tag> mise run npm-publish-dry-run`
