# eval-pod

A privileged Docker-in-Docker image that runs one benchmark end-to-end inside
CI. A single self-contained pod that bundles, in one image:

- the `@vellumai/evals` CLI, run by `bun` (no build step — `bun` runs the
  TypeScript directly via an `evals` shim on `PATH`);
- a nested `dockerd` (the `docker:28-dind` base) the harness uses to build its
  recording/hermes/browser sidecars and hatch the species container;
- the `vellum-evals-runtime` named OCI runtime, which mutates the single
  opted-in species container so its egress is recorded — see
  [`vellum-evals-runtime/README.md`](vellum-evals-runtime/README.md) for the
  runtime / recording-CA contract.

The pod is launched in metered mode by the K8s launcher (ATL-928) and the image
is built and published in CI (ATL-932). This directory only authors the image.

## What it does

The entrypoint is `start.sh`. On `docker run` it:

1. requires `ANTHROPIC_API_KEY` (the only runtime credential; fail-fast);
2. brings up the inner `dockerd` and waits for its socket;
3. provisions the recording CA to `/etc/eval-pod/recording-ca.pem` (the path the
   runtime bind-mounts into the species container's trust store);
4. execs `evals <args>` with whatever subcommand + flags the launcher supplied.

A bare `docker run` (no args) prints CLI usage (`evals --help`), matching the
image's default `CMD ["--help"]`.

## Build (CI-parity)

Run from the **repo root** so the build context covers both the package source
(`src/`, `benchmarks/`, `profiles/`, manifests) and the runtime source under
`docker/eval-pod/vellum-evals-runtime/`:

```sh
docker buildx build --platform linux/amd64 \
  -f docker/eval-pod/Dockerfile -t eval-pod:local .
```

## Run locally for testing

The nested `dockerd` requires `--privileged`. The only secret is injected at
runtime; nothing is baked into the image:

```sh
docker run --rm --privileged \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  eval-pod:local \
  run --profiles vellum-default --benchmark personal-intelligence --filter <unit>
```

`--profiles` takes committed profile ids (e.g. `vellum-default`,
`hermes-default`); `--benchmark` takes a committed benchmark id (e.g.
`personal-intelligence`, `longmemeval-v2`). Omit `--filter` to run every unit.

## Smoke test without a full run

To exercise the bundled CLI without bringing up `dockerd` or running a
benchmark, override the entrypoint:

```sh
docker run --rm --entrypoint evals eval-pod:local benchmarks list
```

## Secrets

Only `ANTHROPIC_API_KEY` is consumed, injected at runtime by the launcher.
Nothing is baked into the image. The LongMemEval OpenAI judge key is deferred.

## Out of scope

This directory authors only the image. The following ship elsewhere:

- **K8s launcher** (ATL-928) — runs the pod in metered mode.
- **CI publish workflow** (ATL-932) — builds for `linux/amd64` and pushes to
  Artifact Registry (`us-central1-docker.pkg.dev/vellum-nonprod/eval-pod-images`).
- **results DB / panel / live results** (ATL-930 / ATL-929 / ATL-931).
