# Docker Distribution

Skillet publishes a lightweight Linux musl-based GHCR image with `sklt` as the entrypoint.

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

Run it directly:

```bash
docker run --rm ghcr.io/echohello-dev/skillet:<version> --help
```

Repository automation:

- `.github/workflows/docker-image.yaml` publishes a multi-arch lightweight image to `ghcr.io/<owner>/skillet:<version>` and updates `:latest` for tagged releases.
