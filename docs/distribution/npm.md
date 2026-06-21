# npm Distribution

Skillet publishes the same content under two npm names so users can install with whichever they prefer:

- **`getskillet`** (primary, unscoped) — `npm i -g getskillet` or `npx getskillet ...`
- **`@echohello/skillet`** (alias, scoped) — `npm i -g @echohello/skillet` or `npx @echohello/skillet ...`

After install, the binary is the same in both cases: `skillet` (default) with `sklt` as a shorthand alias — both names are wired in `package.json` `bin` and point at `dist/npm/cli.js`.

## Packaging Model

- `src/cli.ts` is bundled to `dist/npm/cli.js` targeting Node.
- The primary `package.json` is `getskillet`; the `bin` field exposes both `skillet` and `sklt`, both pointing to `dist/npm/cli.js`.
- The CLI runtime detects which name the user invoked (via `process.argv[1]`) and rewrites the displayed `bin` so `skillet --version` reports `skillet/1.x.y` while `sklt --version` reports `sklt/1.x.y`. The version number is always identical.
- The CI workflow re-builds the same bundle under `dist/npm-alias/` with a rewritten `name: @echohello/skillet` and publishes it as the scoped alias. Same tarball content, different package identity.
- `prepack` rebuilds the npm CLI bundle automatically.

## Local Validation

```bash
mise run build-npm
npm pack
npx --yes --package ./getskillet-<version>.tgz skillet --help
npx --yes --package ./getskillet-<version>.tgz sklt --help
bunx --bun --package ./getskillet-<version>.tgz skillet --help
bunx --bun --package ./getskillet-<version>.tgz sklt --help
mise run npm-publish-dry-run
```

Or run the smoke check that exercises both bin entries end-to-end:

```bash
mise run npm-smoke
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
   - **Environment name:** `production` *(must match the `environment:` declared on the publish job)*
3. **Confirm the workflow file** at `.github/workflows/npm-publish.yaml` has `id-token: write` in its `permissions:` block and a `production` GitHub Environment exists (already set).
4. Repeat step 2 for the alias package at https://www.npmjs.com/package/@echohello/skillet/access if you also want OIDC publishes for the scoped name.

After this, all future `npm-publish` runs authenticate via OIDC — no token to rotate, leak, or steal.

Manual dispatch inputs:

- `ref`: tag, branch, or commit to publish
- `npm_tag`: npm dist-tag, defaults to `latest`
- `dry_run`: when true, runs `npm publish --dry-run` and skips the real publish step
- When `dry_run` is true, the workflow uses the provided `npm_tag`, or falls back to `dry-run` if you leave it at `latest`.
- `auth_method`: `oidc` (default, uses GitHub OIDC trusted publisher) or `manual_otp` (uses a legacy `NPM_TOKEN` secret plus a one-time password from the dispatch input). Use `manual_otp` when the OIDC integration is failing or for a one-off bootstrap publish.
- `npm_otp`: required when `auth_method=manual_otp`. Provide the current 2FA OTP code from your authenticator. The value is masked in workflow logs but still surfaces in the dispatch payload; rotate the OTP after each dispatch.

### Manual OTP bootstrap publish

When the OIDC trusted publisher is misbehaving (for example, returning `404 'getskillet is not in this registry'` during automated release publishes), fall back to manual OTP:

1. Add `NPM_TOKEN` as an environment secret on the GitHub `production` environment (Settings → Environments → production → Add secret). Use a legacy automation token from `npmjs.com → Access Tokens → Automation` with 2FA-required publish scope.
2. Trigger `npm-publish.yaml` via `workflow_dispatch` with `auth_method=manual_otp` and `npm_otp=<6-digit code>`.
3. The workflow writes `NODE_AUTH_TOKEN` from the secret to `$GITHUB_ENV`, which overrides the `actions/setup-node` OIDC value for the publish steps. Both `getskillet` and `@echohello/skillet` are published with `--otp` against the same code.
4. Rotate the OTP after the run completes and consider rotating the `NPM_TOKEN` secret if it was exposed in any logs.

This path is intentionally heavier than OIDC (manual step + secret rotation). It exists to unblock a release when the trusted publisher configuration is broken; it should not be the default.

Local command:

- `mise run npm-publish-dry-run`: builds the npm CLI bundle and runs `npm publish --dry-run --tag dry-run`
- Override the dry-run tag if needed with `NPM_DIST_TAG=<tag> mise run npm-publish-dry-run`
