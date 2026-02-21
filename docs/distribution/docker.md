# Docker Distribution

Skillet publishes a Linux musl-based container image with `skillet` as the entrypoint.

## Build Inputs

The image requires these release artifacts in `dist/`:

- `skillet-linux-x64-musl`
- `skillet-linux-arm64-musl`

## Local Build and Test

```bash
mise run build -- --targets=linux-x64-musl,linux-arm64-musl
docker build --platform=linux/amd64 -t skillet:local .
docker run --rm skillet:local --help
```

## Publish (GHCR)

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/echohello-dev/skillet:<version> \
  -t ghcr.io/echohello-dev/skillet:latest \
  --push .
```

Repository automation:

- `.github/workflows/docker-image.yaml` publishes `ghcr.io/<owner>/skillet:<version>` on release.
