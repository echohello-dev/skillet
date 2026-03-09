# syntax=docker/dockerfile:1.7
FROM alpine:3.22

ARG TARGETARCH

RUN apk add --no-cache libstdc++ libgcc

COPY dist/sklt-linux-x64-musl /tmp/sklt-linux-x64-musl
COPY dist/sklt-linux-arm64-musl /tmp/sklt-linux-arm64-musl

RUN set -eux; \
  case "$TARGETARCH" in \
    amd64) cp /tmp/sklt-linux-x64-musl /usr/local/bin/sklt ;; \
    arm64) cp /tmp/sklt-linux-arm64-musl /usr/local/bin/sklt ;; \
    *) echo "Unsupported TARGETARCH: $TARGETARCH" >&2; exit 1 ;; \
  esac; \
  chmod +x /usr/local/bin/sklt; \
  rm -f /tmp/sklt-linux-x64-musl /tmp/sklt-linux-arm64-musl

ENTRYPOINT ["/usr/local/bin/sklt"]
CMD ["--help"]
