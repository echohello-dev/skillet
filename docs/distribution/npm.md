# npm Distribution

Skillet publishes an npm package so users can run:

- `npx skillet ...`
- `bunx skillet ...`

## Packaging Model

- `src/cli.ts` is bundled to `dist/npm/cli.js` targeting Node.
- `package.json` `bin.skillet` points to `dist/npm/cli.js`.
- `prepack` rebuilds the npm CLI bundle automatically.

## Local Validation

```bash
mise run build-npm
npm pack
npx --yes --package ./skillet-<version>.tgz skillet --help
bunx --bun --package ./skillet-<version>.tgz skillet --help
```

## Publish

```bash
npm publish --access public
```
