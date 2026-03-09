# syntax=docker/dockerfile:1.7
FROM alpine:3.22 AS runtime-base

RUN apk add --no-cache libstdc++ libgcc

FROM runtime-base AS runtime-amd64

COPY --chmod=755 dist/skillet-linux-x64-musl /usr/local/bin/skillet

FROM runtime-base AS runtime-arm64

COPY --chmod=755 dist/skillet-linux-arm64-musl /usr/local/bin/skillet

ARG TARGETARCH
FROM runtime-${TARGETARCH}

RUN ln -s /usr/local/bin/skillet /usr/local/bin/sklt

ENTRYPOINT ["/usr/local/bin/sklt"]
CMD ["--help"]
