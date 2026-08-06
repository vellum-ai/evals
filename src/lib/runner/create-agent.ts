import type { AgentHatchInput, BaseAgent } from "../adapter";
import { createHermesAgent } from "../adapters/hermes";
import { createVellumAgent } from "../adapters/vellum";

export function createAgent(input: AgentHatchInput): BaseAgent {
  switch (input.profile.manifest.species) {
    case "vellum": {
      // EVALS_VELLUM_CLI pins the `vellum` CLI binary (e.g. one built from
      // the same checkout as EVALS_ASSISTANT_SOURCE for a baseline-at-commit
      // run) instead of whatever `vellum` is on PATH.
      const cliCommand = process.env.EVALS_VELLUM_CLI?.trim();
      return createVellumAgent(input, cliCommand ? { cliCommand } : {});
    }
    case "hermes":
      return createHermesAgent(input);
    default:
      throw new Error(
        `No eval adapter registered for species=${input.profile.manifest.species}`,
      );
  }
}
