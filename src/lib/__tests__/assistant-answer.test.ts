import { describe, expect, test } from "bun:test";

import { formatConversationText } from "../common-metrics/assistant-answer";
import type { TranscriptViewItem } from "../transcript-view";

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
