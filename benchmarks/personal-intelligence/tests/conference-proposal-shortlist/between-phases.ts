import type { PhaseDirective } from "../../../../src/lib/phase-directive";

// Days pass between shortlisting the CFP and noticing the sponsor blurb
// is wrong. Only the conversation rotates — no retrospective is forced,
// because this test is about the delegation decision in each phase, not
// about anything carried between them.
export default [{ type: "new-conversation" }] satisfies PhaseDirective[];
