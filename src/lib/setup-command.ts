export type SeededConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export type TestSetupCommand =
  | {
      /**
       * Seed pre-existing conversation history without asking the live agent
       * LLM to respond. Each adapter bridges this into its own runtime
       * representation.
       */
      type: "seed-conversation";
      messages: SeededConversationMessage[];
    }
  | {
      /**
       * Stage a file into the agent's workspace before the conversation
       * starts, modelling a document the user "already uploaded". Adapters
       * bridge this onto their own writable workspace boundary; species that
       * expose none reject it. `path` is workspace-relative and must not
       * escape the workspace root.
       */
      type: "stage-workspace-file";
      path: string;
      content: string;
      /**
       * How `content` encodes the file's bytes. `"utf8"` (default) writes
       * the string as-is; `"base64"` decodes it first, for binary fixtures
       * (images, PDFs) that can't ride a UTF-8 string without corruption.
       */
      encoding?: "utf8" | "base64";
    };
