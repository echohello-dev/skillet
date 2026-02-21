# syntax=docker/dockerfile:1.7
FROM alpine:3.22

ARG TARGETARCH

RUN apk add --no-cache libstdc++ libgcc

COPY dist/skillet-linux-x64-musl /tmp/skillet-linux-x64-musl
COPY dist/skillet-linux-arm64-musl /tmp/skillet-linux-arm64-musl

RUN set -eux; \
  case "$TARGETARCH" in \
    amd64) cp /tmp/skillet-linux-x64-musl /usr/local/bin/skillet ;; \
    arm64) cp /tmp/skillet-linux-arm64-musl /usr/local/bin/skillet ;; \
    *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  chmod +x /usr/local/bin/skillet; \
  rm -f /tmp/skillet-linux-x64-musl /tmp/skillet-linux-arm64-musl

ENTRYPOINT ["/usr/local/bin/skillet"]
CMD ["--help"]
