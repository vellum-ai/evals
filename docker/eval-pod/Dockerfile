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
#   - the `vellum` CLI (from npm, @vellumai/cli@latest) that the Vellum species
#     adapter shells out to in order to hatch the assistant for vellum-* profiles,
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

# The Vellum species adapter (vellum-* profiles, e.g. vellum-default) shells out
# to a `vellum` binary to hatch the assistant — see src/lib/adapters/vellum.ts.
# That CLI is NOT part of the evals package, so install it from npm into an
# isolated prefix (keeping it out of /app's node_modules) and expose it on PATH
# via a shim mirroring the `evals` one above. The published @vellumai/cli bundles
# its file: workspace deps (@vellumai/environments, @vellumai/local-mode), so a
# plain `bun add` is self-contained. The adapter calls `vellum hatch --source
# <repoRoot>`; that path holds no assistant source tree in this image, so the CLI
# logs a warning and falls back to pulling the published assistant/gateway/
# credential-executor images at runtime (no source tree is bundled here).
#
# Track the latest published CLI rather than pinning a version: the assistant
# images hatch pulls are resolved from the latest stable platform release, so the
# CLI is kept in lock-step by always installing @vellumai/cli@latest. Each image
# build picks up the newest CLI at build time.
RUN mkdir -p /opt/vellum-cli \
    && cd /opt/vellum-cli \
    && printf '%s\n' '{ "name": "vellum-cli-host", "private": true }' > package.json \
    && bun add @vellumai/cli@latest \
    && printf '%s\n' '#!/bin/sh' \
       'exec bun /opt/vellum-cli/node_modules/@vellumai/cli/src/index.ts "$@"' \
       > /usr/local/bin/vellum \
    && chmod +x /usr/local/bin/vellum

# Entrypoint: dockerd bring-up + CA provisioning + exec evals.
COPY docker/eval-pod/start.sh /usr/local/bin/start.sh
RUN chmod +x /usr/local/bin/start.sh

# Make the recording-CA host-path contract explicit (consumed by start.sh and
# the runtime binary). No secret — just the path the startup script writes to.
ENV VELLUM_EVALS_RUNTIME_CA_HOST_PATH=/etc/eval-pod/recording-ca.pem
RUN mkdir -p /etc/eval-pod

# Install plugins (e.g. the vellum-simple-memory profile) directly from their
# public source repos at the marketplace's pinned commit SHAs, instead of the
# hermetic mock that serves a curated `plugins/` fixture tree from the assistant
# repo. This image ships no such fixture tree and relies only on public
# artifacts, so it opts into live plugin installs; the Vellum adapter then
# allowlists the public GitHub Contents+Raw hosts in the egress jail (passthrough,
# not recorded) and skips the mock. The pod therefore needs GitHub reachable at
# run time for plugin-installing profiles. See src/lib/adapters/vellum.ts.
ENV EVALS_PLUGIN_INSTALL_LIVE=1

# LongMemEval-V2's ~7.12 GB dataset is gitignored — the image ships
# benchmarks/longmemeval-v2/data/ with only download.ts + question-labels.json.
# EVALS_DATA_AUTO_DOWNLOAD=1 opts the harness into fetching the dataset at
# benchmark-load time (only for runs that request that benchmark; see
# benchmarks/longmemeval-v2/src/ensure-dataset.ts). huggingface-cli is the
# fetcher the download module shells out to; alpine's Python is externally
# managed (PEP 668), so it lives in its own venv with a PATH shim. Pin
# huggingface_hub <1.0: the 1.x line replaces `huggingface-cli` with `hf` and
# ships only a deprecation stub under the old name (exits nonzero), while the
# download module invokes `huggingface-cli download …`.
RUN apk add --no-cache python3 py3-pip \
    && python3 -m venv /opt/hf \
    && /opt/hf/bin/pip install --no-cache-dir "huggingface_hub[cli]<1.0" \
    && ln -s /opt/hf/bin/huggingface-cli /usr/local/bin/huggingface-cli
ENV EVALS_DATA_AUTO_DOWNLOAD=1

ENTRYPOINT ["/usr/local/bin/start.sh"]
# A bare `docker run` prints CLI usage; the launcher supplies `run --profiles …`.
CMD ["--help"]
