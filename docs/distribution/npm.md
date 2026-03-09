# npm Distribution

Skillet publishes an npm package so users can run:

- `npx sklt ...`
- `bunx sklt ...`

## Packaging Model

- `src/cli.ts` is bundled to `dist/npm/cli.js` targeting Node.
- `package.json` exposes `sklt` pointing to `dist/npm/cli.js`.
- `prepack` rebuilds the npm CLI bundle automatically.

## Local Validation

```bash
mise run build-npm
npm pack
npx --yes --package ./sklt-<version>.tgz sklt --help
bunx --bun --package ./sklt-<version>.tgz sklt --help
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
- The workflow uses the GitHub Actions environment `npm-publish`.
- Add `NPM_TOKEN` as an environment secret in `npm-publish` using the value from your local `.env`.
- GitHub Actions cannot read your local `.env` file directly.

Manual dispatch inputs:

- `ref`: tag, branch, or commit to publish
- `npm_tag`: npm dist-tag, defaults to `latest`
- `dry_run`: when true, runs `npm publish --dry-run` and skips the real publish step
- When `dry_run` is true, the workflow uses the provided `npm_tag`, or falls back to `dry-run` if you leave it at `latest`.

Local command:

- `mise run npm-publish-dry-run`: builds the npm CLI bundle and runs `npm publish --dry-run --tag dry-run`
- Override the dry-run tag if needed with `NPM_DIST_TAG=<tag> mise run npm-publish-dry-run`
