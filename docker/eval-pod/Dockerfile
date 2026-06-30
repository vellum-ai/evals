# Privileged Docker-in-Docker eval-pod image.
#
# A single self-contained pod that runs one benchmark end-to-end inside CI.
# It bundles, in one image:
#   - the `@vellumai/evals` CLI (bun-native, no build step — bun runs the
#     TypeScript directly via an `evals` shim on PATH),
#   - a nested `dockerd` (the `docker:28-dind` base) the harness uses to build
#     its recording/hermes/browser sidecars and hatch the species container,
#   - the `vellum-evals-runtime` named OCI runtime (built in stage 1 below and
#     registered via daemon.json) that mutates the single opted-in species
#     container so its egress is recorded — see
#     docker/eval-pod/vellum-evals-runtime/README.md,
#   - `start.sh`, which brings dockerd up, provisions the recording CA, and
#     execs the bundled CLI.
#
# Build context is the repo root (so `src/`, `benchmarks/`, `profiles/`, and the
# runtime source all ship in). Built in CI for linux/amd64 and pushed to
# Artifact Registry by ATL-932 — NOT here. Secrets (ANTHROPIC_API_KEY) are
# injected at runtime by the launcher; nothing is baked in.

# --- Stage 1: build the static vellum-evals-runtime binary --------------------
# Match go.mod's `go 1.22`; the runtime is stdlib-only so no module download is
# needed. Build command is verbatim from the runtime README's Build section.
FROM golang:1.22-alpine AS runtime-builder
WORKDIR /build
COPY docker/eval-pod/vellum-evals-runtime/ ./
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/vellum-evals-runtime ./

# --- Stage 2: final privileged DinD image -------------------------------------
# The official Docker-in-Docker base is alpine-based and ships dockerd, the
# docker CLI, containerd, runc, and dockerd-entrypoint.sh.
FROM docker:28-dind

# Extra userland beyond the dind base. The dind base already ships sh, grep,
# ca-certificates, and the coreutils-equivalent busybox applets, and the harness
# execs binaries (docker, vellum, …) directly rather than through a shell — so
# the only thing missing is bun's runtime libs: the alpine `bun` binary is
# dynamically linked against libstdc++/libgcc (the same deps oven/bun:alpine
# installs), which must be present for `bun` to run on this base.
RUN apk add --no-cache libstdc++ libgcc

# Bun is the package runtime. Use the musl/alpine variant so the binary matches
# this alpine-based final base; pin a specific minor tag for reproducibility.
COPY --from=oven/bun:1.3-alpine /usr/local/bin/bun /usr/local/bin/bun

# The named OCI runtime, installed where daemon.json points dockerd at it.
COPY --from=runtime-builder /out/vellum-evals-runtime /usr/local/bin/vellum-evals-runtime
RUN chmod 0755 /usr/local/bin/vellum-evals-runtime

# The runtime defaults to exec'ing real runc at /usr/bin/runc. The dind base may
# ship runc only at /usr/local/bin/runc; symlink it here at build time (the image
# filesystem is immutable at runtime, so this is the only place it needs doing).
RUN if [ ! -e /usr/bin/runc ] && [ -e /usr/local/bin/runc ]; then \
      ln -sf /usr/local/bin/runc /usr/bin/runc; \
    fi

# Register the named runtime with the inner dockerd.
COPY docker/eval-pod/daemon.json /etc/docker/daemon.json

# Install the evals package source + deps. Copy manifests first and `bun install`
# before the source so that layer caches across source-only changes. No
# --frozen-lockfile: bun.lock is gitignored/absent, and `[install] exact=true`
# plus pinned versions in package.json keep installs reproducible.
WORKDIR /app
COPY package.json bunfig.toml ./
RUN bun install
COPY src ./src
COPY benchmarks ./benchmarks
COPY profiles ./profiles
COPY tsconfig.json ./

# `evals` shim on PATH. Prefer a 2-line exec wrapper over `bun link`: it runs the
# package's CLI entry (src/cli.ts) directly, which is how the package is designed
# to be invoked (package.json `bin: { "evals": "./src/cli.ts" }`).
RUN printf '%s\n' '#!/bin/sh' 'exec bun /app/src/cli.ts "$@"' > /usr/local/bin/evals \
    && chmod +x /usr/local/bin/evals

# Entrypoint: dockerd bring-up + CA provisioning + exec evals.
COPY docker/eval-pod/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Make the recording-CA host-path contract explicit (consumed by start.sh and
# the runtime binary). No secret — just the path the startup script writes to.
ENV VELLUM_EVALS_RUNTIME_CA_HOST_PATH=/etc/eval-pod/recording-ca.pem
RUN mkdir -p /etc/eval-pod

ENTRYPOINT ["/usr/local/bin/start.sh"]
# A bare `docker run` prints CLI usage; the launcher supplies `run --profiles …`.
CMD ["--help"]
