#!/bin/sh
# Entrypoint for the privileged eval-pod (Docker-in-Docker) image.
#
# Brings the pod up to the point where the bundled `evals` CLI can run a
# benchmark, then hands off to it. In order:
#   1. Require ANTHROPIC_API_KEY (the only runtime credential; injected by
#      the launcher, never baked into the image).
#   2. Start the inner dockerd and wait for its socket to be live, so no
#      inner container is created against a half-up daemon. The dind base's
#      `dockerd-entrypoint.sh` sets up cgroups + the local socket and reads
#      /etc/docker/daemon.json (where the vellum-evals-runtime is registered).
#   3. Provision the recording CA to the host path the runtime expects,
#      BEFORE any inner container exists, by building the recording image and
#      extracting its baked mitmproxy CA. The runtime bind-mounts this file
#      into the species container's trust store; it must equal the CA
#      mitmproxy presents, so we extract the exact baked cert.
#   4. exec the bundled `evals` CLI with the launcher-supplied subcommand+flags.
#
# `-h`/`--help`/no args short-circuit to `evals --help` before any of the above,
# so a bare `docker run` prints usage without credentials or a running dockerd.
#
# Matches the repo's other entrypoints (src/lib/egress/*/entrypoint.sh):
# `#!/bin/sh`, `set -eu`, `VAR="${VAR:-default}"` defaulting, fail-fast checks.

set -eu

# Help/usage must work without credentials or a running dockerd, so a bare
# `docker run` (the image's CMD is ["--help"]) or an explicit `-h`/`--help`
# prints usage and exits without requiring ANTHROPIC_API_KEY or dockerd.
case "${1:-}" in
  -h | --help | "")
    exec evals --help
    ;;
esac

# 1. Require the only runtime credential. Fail fast; never echo the value.
: "${ANTHROPIC_API_KEY:?ANTHROPIC_API_KEY must be injected by the launcher}"

# 2. Bring up the inner dockerd. The dind base ships dockerd-entrypoint.sh,
#    which configures the local socket + cgroups and reads daemon.json (so the
#    named vellum-evals-runtime is registered). Run it in the background and
#    block until `docker info` succeeds, guaranteeing the daemon is live before
#    any image build / container create below.
dockerd-entrypoint.sh dockerd >/var/log/dockerd.log 2>&1 &

i=0
until docker info >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge 60 ]; then
    echo "dockerd did not become ready after 60 attempts; /var/log/dockerd.log:" >&2
    cat /var/log/dockerd.log >&2 || true
    exit 1
  fi
  sleep 0.5
done

# 3. Provision the recording CA BEFORE any inner container is created (the
#    vellum-evals-runtime README contract: it bind-mounts this host file into
#    the species container's trust store). The recording sidecar runs
#    `mitmdump --set confdir=/opt/recording/mitmproxy-conf`, so the CA it
#    presents is the one baked into the recording image at
#    /opt/recording/mitmproxy-conf/mitmproxy-ca-cert.pem. Extracting THAT exact
#    cert here keeps the runtime's bind-mounted host CA consistent with the cert
#    mitmproxy presents — otherwise intercepted TLS fails closed.
CA_HOST_PATH="${VELLUM_EVALS_RUNTIME_CA_HOST_PATH:-/etc/eval-pod/recording-ca.pem}"
RECORDING_IMAGE="${RECORDING_IMAGE:-vellum-evals-recording-jail:local}"
RECORDING_DOCKERFILE_DIR="${RECORDING_DOCKERFILE_DIR:-/app/src/lib/egress/recording}"

mkdir -p "$(dirname "$CA_HOST_PATH")"

# Build the recording image once up front so the baked CA we extract is
# identical to the one the harness's mitmproxy sidecar will present.
docker build -t "$RECORDING_IMAGE" "$RECORDING_DOCKERFILE_DIR"

# Extract the baked CA without leaving a container running (`--rm`).
docker run --rm --entrypoint cat "$RECORDING_IMAGE" \
  /opt/recording/mitmproxy-conf/mitmproxy-ca-cert.pem >"$CA_HOST_PATH"
chmod 644 "$CA_HOST_PATH"

if [ ! -s "$CA_HOST_PATH" ] || ! grep -q "BEGIN CERTIFICATE" "$CA_HOST_PATH"; then
  echo "recording CA at $CA_HOST_PATH is empty or not PEM-shaped" >&2
  exit 1
fi

# 4. Hand off to the bundled CLI. The launcher passes the subcommand + flags as
#    container args (e.g. `run --profiles vellum-default --benchmark
#    personal-intelligence`); don't hardcode `run` so the same entrypoint serves
#    `benchmarks list`, `export`, etc. The no-args/help case is handled by the
#    short-circuit at the top, so here we always have a real subcommand.
exec evals "$@"
