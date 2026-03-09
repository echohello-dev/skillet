# Docker Distribution

Skillet publishes a Linux musl-based container image with `sklt` as the entrypoint.

## Build Inputs

The image requires these release artifacts in `dist/`:

- `sklt-linux-x64-musl`
- `sklt-linux-arm64-musl`

## Local Build and Test

```bash
mise run build -- --targets=linux-x64-musl,linux-arm64-musl
docker build --platform=linux/amd64 -t sklt:local .
docker run --rm sklt:local --help
```

## Publish (GHCR)

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/echohello-dev/sklt:<version> \
  -t ghcr.io/echohello-dev/sklt:latest \
  --push .
```

Repository automation:

- `.github/workflows/docker-image.yaml` publishes `ghcr.io/<owner>/sklt:<version>` on release.
