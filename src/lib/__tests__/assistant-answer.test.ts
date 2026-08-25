import { describe, expect, test } from "bun:test";

import {
  formatConversationText,
  joinAssistantMessagesText,
} from "../common-metrics/assistant-answer";
import type { TranscriptViewItem } from "../transcript-view";

describe("joinAssistantMessagesText", () => {
  test("folds a streamed reply back into one unbroken string", () => {
    // The Vellum stream lands one transcript turn per text delta. A
    // verbatim comparison over the raw turns sees "v 3 . 14 . 2" where
    // the assistant wrote "v3.14.2", so the fold has to happen first.
    const items: TranscriptViewItem[] = [
      {
        role: "assistant",
        blocks: [
          { kind: "text", text: "Version is v3." },
          { kind: "text", text: "14.2 (build 8827)" },
        ],
      },
    ];
    expect(joinAssistantMessagesText(items)).toBe(
      "Version is v3.14.2 (build 8827)",
    );
  });

  test("keeps a string the assistant gave before a later message", () => {
    // The run ends on a confirmation, and the graded string is in the
    // message before it. Grading the last message alone reports the
    // string as never given.
    const items: TranscriptViewItem[] = [
      { role: "simulator", emittedAt: "1", content: "What version?" },
      {
        role: "assistant",
        blocks: [{ kind: "text", text: "v3.14.2 (build 8827)" }],
      },
      { role: "simulator", emittedAt: "2", content: "Exactly that?" },
      {
        role: "assistant",
        blocks: [{ kind: "text", text: "Yes, character for character." }],
      },
    ];
    expect(joinAssistantMessagesText(items)).toContain("v3.14.2 (build 8827)");
  });

  test("skips messages that carry no spoken text", () => {
    const items: TranscriptViewItem[] = [
      {
        role: "assistant",
        blocks: [
          { kind: "tool_call", toolName: "file_read", status: "running" },
        ],
      },
      { role: "assistant", blocks: [{ kind: "text", text: "Done." }] },
    ];
    expect(joinAssistantMessagesText(items)).toBe("Done.");
  });

  test("an empty view renders as an empty string", () => {
    expect(joinAssistantMessagesText([])).toBe("");
  });
});

describe("formatConversationText", () => {
  test("interleaves the turns as labelled blocks", () => {
    const items: TranscriptViewItem[] = [
      { role: "simulator", emittedAt: "1", content: "What is the total?" },
      {
        role: "assistant",
        blocks: [{ kind: "text", text: "It is $148.34." }],
      },
    ];
    expect(formatConversationText(items)).toBe(
      "User: What is the total?\n\nAssistant: It is $148.34.",
    );
  });

  test("drops thinking and tool blocks, keeping the spoken text", () => {
    // A judge grading which question got which answer must not have to
    // read past a tool result that quotes the answer it is looking for.
    const items: TranscriptViewItem[] = [
      {
        role: "assistant",
        blocks: [
          { kind: "thinking", thinking: "the serial is probably SN-1" },
          {
            kind: "tool_call",
            toolName: "image_ask",
            status: "completed",
            result: "Not visible in the image",
          },
          { kind: "text", text: "The screenshot shows no serial number." },
        ],
      },
    ];
    expect(formatConversationText(items)).toBe(
      "Assistant: The screenshot shows no serial number.",
    );
  });

  test("an assistant message with no text is skipped entirely", () => {
    const items: TranscriptViewItem[] = [
      { role: "simulator", emittedAt: "1", content: "And the photo?" },
      {
        role: "assistant",
        blocks: [
          { kind: "tool_call", toolName: "file_read", status: "running" },
        ],
      },
    ];
    expect(formatConversationText(items)).toBe("User: And the photo?");
  });

  test("an empty conversation renders as an empty string", () => {
    expect(formatConversationText([])).toBe("");
  });
});
