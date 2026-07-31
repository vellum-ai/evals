/**
 * Directives a multi-phase test runs between its conversation phases.
 *
 * A phase is one simulator-driven conversation; directives model the
 * background work that separates real sessions — "the user closed the
 * app, time passed, background jobs ran, the user came back." They run
 * after the previous phase's simulator ends and before the next phase's
 * first message.
 *
 * Adapters implement each directive against their species' runtime (see
 * `BaseAgent.triggerRetrospective` / `newConversation`); species without
 * an equivalent reject at run time, exactly like setup commands.
 */
export type PhaseDirective =
  | {
      /**
       * Force the assistant's memory retrospective for the conversation
       * so far and wait for it to finish. On Vellum this is the async
       * background pass that (on v3-live workspaces) authors procedural
       * skills from tool-use it reviews.
       */
      type: "trigger-retrospective";
    }
  | {
      /**
       * Rotate to a fresh conversation, so the next phase starts with no
       * in-context history — recall must come from the agent's memory
       * layer and durable artifacts, not the transcript.
       */
      type: "new-conversation";
    };
