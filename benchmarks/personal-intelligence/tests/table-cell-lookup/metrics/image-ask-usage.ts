/**
 * Diagnostic: how this run reached the pixels of the staged image.
 * Shared across every image-extraction case, so the caption and
 * handle-only profiles are read on the same counts. See the module it
 * re-exports.
 */
export { default } from "../../../../../src/lib/common-metrics/image-ask-usage";
