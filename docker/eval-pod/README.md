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
  runtime / recording-CA contract;
- the `vellum` CLI (installed from npm, `@vellumai/cli@latest`), which the Vellum
  species adapter shells out to in order to hatch the assistant for `vellum-*`
  profiles.

The pod is launched in metered mode by the K8s launcher (ATL-928) and the image
is built and published in CI (ATL-932). This directory only authors the image.

## What it does

The entrypoint is `start.sh`. On `docker run` it:

1. requires `ANTHROPIC_API_KEY` (the only required credential; fail-fast);
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

The nested `dockerd` requires `--privileged`. Secrets are injected at
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

`vellum-*` profiles hatch the assistant via the bundled `vellum` CLI. The image
ships no assistant source tree, so `vellum hatch` falls back to pulling the
published assistant / gateway / credential-executor images at runtime — the pod
therefore needs registry access for those images (in addition to the model
egress the harness records).

Plugin-installing profiles (e.g. `vellum-simple-memory`) work too: the image
sets `EVALS_PLUGIN_INSTALL_LIVE=1`, so instead of the hermetic mock that serves a
curated `plugins/` fixture tree from the assistant repo, the harness installs the
plugin straight from its public source repo at the marketplace's pinned commit
SHA. The Vellum adapter allowlists the public GitHub Contents + Raw hosts in the
egress jail (passthrough — not TLS-intercepted or recorded, since these are bulk
content fetches, not model traffic), so the pod also needs `api.github.com` and
`raw.githubusercontent.com` reachable at run time.

**LongMemEval-V2 dataset.** The image sets `EVALS_DATA_AUTO_DOWNLOAD=1` and
bundles `huggingface-cli`: when a run requests `--benchmark longmemeval-v2` and
the gitignored dataset is absent, the harness downloads the
`xiaowu0162/longmemeval-v2` dataset from Hugging Face at benchmark-load time,
before the run proper (runs of other benchmarks are unaffected and perform no
download). Operators must budget for this: the pod needs **~7.12 GB of
ephemeral disk headroom** for the dataset (on top of normal image/run
overhead), and **egress to `huggingface.co` and its CDN hosts**
(`cdn-lfs*.huggingface.co` / `*.hf.co`) — the fetch happens in the harness's
own network context, outside the recording jail that wraps species traffic.
Retries are safe: `huggingface-cli` hash-skips files already downloaded and
the relabel step is idempotent. The dataset is public, so no Hugging Face
token or new secret is required. When pre-staging the dataset via
`EVALS_LONGMEMEVAL_DATA_ROOT`, the mount SHOULD be writable: even with the
data fully present, the harness runs an idempotent relabel self-heal at run
start that writes into the dataRoot. On a read-only mount the self-heal
relabel is skipped with a warning and the loader validates the data as-is.

## Smoke test without a full run

To exercise the bundled CLI without bringing up `dockerd` or running a
benchmark, override the entrypoint:

```sh
docker run --rm --entrypoint evals eval-pod:local benchmarks list
```

## Secrets

`ANTHROPIC_API_KEY` is the only required credential, injected at runtime by
the launcher. Nothing is baked into the image. The LongMemEval OpenAI judge
key is deferred.

The launcher may also inject these optional env vars for live results:

- `EVAL_RESULTS_UPLOAD_URL` — enables live run-event posting during the run
  and post-run auto-publish of the session bundle to the QA dashboard.
- `EVAL_RESULTS_SESSION_ID` — pins the harness session id so the launcher's
  run id and the uploaded bundle id coincide.
- `QA_AUTH_TOKEN` — second runtime secret; Bearer token authenticating the
  event posts and the bundle upload.

## Out of scope

This directory authors only the image. The following ship elsewhere:

- **K8s launcher** (ATL-928) — runs the pod in metered mode.
- **CI publish workflow** (ATL-932) — builds for `linux/amd64` and pushes to
  Artifact Registry (`us-central1-docker.pkg.dev/vellum-nonprod/eval-pod-images`).
- **results DB / panel / live results** (ATL-930 / ATL-929 / ATL-931).
