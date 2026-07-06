/**
 * Generate the eval-catalog JSON artifact and print it to stdout.
 *
 * CI invokes this from .github/workflows/eval-pod-publish.yaml after the
 * eval-pod image push, then uploads the output to the qa results bucket
 * (`eval-catalog/<sha>.json` + `eval-catalog/latest.json`). The shape is
 * the frozen contract defined in src/lib/catalog-artifact.ts.
 *
 * Usage: GIT_SHA=<sha> IMAGE_TAG=<tag> bun scripts/generate-catalog.ts
 *
 * Only the JSON goes to stdout; diagnostics go to stderr (repo convention).
 */
import { buildCatalogArtifact } from "../src/lib/catalog-artifact";

const gitSha = process.env.GIT_SHA;
const imageTag = process.env.IMAGE_TAG;
if (!gitSha || !imageTag) {
  console.error(
    "generate-catalog: GIT_SHA and IMAGE_TAG env vars are required",
  );
  process.exit(1);
}
const artifact = await buildCatalogArtifact({
  gitSha,
  imageTag,
  generatedAt: new Date().toISOString(),
});
console.log(JSON.stringify(artifact, null, 2));
