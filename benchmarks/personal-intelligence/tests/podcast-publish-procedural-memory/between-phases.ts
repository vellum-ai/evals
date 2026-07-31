import type { PhaseDirective } from "../../../../src/lib/phase-directive";

// Compress "the user closed the app and came back later" into a
// deterministic point: force the memory retrospective over the phase-1
// conversation (the background pass that may author a procedural skill),
// then rotate to a fresh conversation so phase 2 has no in-context
// history — recall must come from memory and workspace artifacts.
export default [
  { type: "trigger-retrospective" },
  { type: "new-conversation" },
] satisfies PhaseDirective[];
