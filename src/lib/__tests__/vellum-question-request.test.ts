import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  normalizeVellumEventStream,
  questionRequestText,
} from "../adapters/vellum";

/** The real payload from
 *  eval-vellum-default-fantasy-league-recap-recurring-20260804201854684-bfa5,
 *  the run that deadlocked for 30 minutes on it. */
const TIMEZONE_QUESTION = {
  type: "question_request",
  requestId: "e887376b-6206-494a-bc23-5431927e91a5",
  question: "What timezone should the Tuesday morning run fire in?",
  options: [
    { id: "America/New_York", label: "Eastern (ET)" },
    { id: "America/Chicago", label: "Central (CT)" },
    { id: "America/Denver", label: "Mountain (MT)" },
    { id: "America/Los_Angeles", label: "Pacific (PT)" },
  ],
};

async function* one(
  message: Record<string, unknown>,
): AsyncIterable<AgentEvent> {
  yield { message } as unknown as AgentEvent;
}

async function collect(
  source: AsyncIterable<AgentEvent>,
): Promise<AgentEvent[]> {
  const out: AgentEvent[] = [];
  for await (const e of source) out.push(e);
  return out;
}

describe("questionRequestText", () => {
  test("flattens the question and its option labels into one line", () => {
    // GIVEN the structured question that deadlocked a run
    // WHEN rendered for the simulator
    const text = questionRequestText(TIMEZONE_QUESTION);

    // THEN the simulator can see both the question and the choices
    expect(text).toBe(
      "What timezone should the Tuesday morning run fire in? (options: Eastern (ET), Central (CT), Mountain (MT), Pacific (PT))",
    );
  });

  test("a free-text question renders without an options clause", () => {
    // GIVEN a question with no options
    const text = questionRequestText({
      type: "question_request",
      question: "Which league scoring format do you use?",
    });

    // THEN it is passed through unadorned
    expect(text).toBe("Which league scoring format do you use?");
  });

  test("a malformed question yields nothing rather than empty text", () => {
    // GIVEN payloads with no usable question
    expect(questionRequestText({ type: "question_request" })).toBeUndefined();
    expect(
      questionRequestText({ type: "question_request", question: "" }),
    ).toBeUndefined();
  });

  test("options without labels are skipped, not rendered as undefined", () => {
    // GIVEN a partially malformed options array
    const text = questionRequestText({
      question: "Pick one",
      options: [{ id: "a" }, { id: "b", label: "Beta" }],
    });

    // THEN only the usable label appears
    expect(text).toBe("Pick one (options: Beta)");
  });
});

describe("normalizeVellumEventStream with question_request", () => {
  test("surfaces the question as assistant transcript text", async () => {
    // GIVEN the deadlocking event
    // WHEN normalized for the runner
    const [event] = await collect(
      normalizeVellumEventStream(one(TIMEZONE_QUESTION)),
    );

    // THEN the runner's assistantContent() sees the question
    expect(event?.message.text).toContain("What timezone");
    expect(event?.message.text).toContain("Eastern (ET)");
  });

  test("still strips text from events that are not transcript", async () => {
    // GIVEN a tool event carrying a stringy field
    const [event] = await collect(
      one({ type: "tool_output_chunk", text: "not the assistant speaking" }),
    );
    const [normalized] = await collect(
      normalizeVellumEventStream(
        one({ type: "tool_output_chunk", text: "not the assistant speaking" }),
      ),
    );

    // THEN the raw event had text and the normalized one does not
    expect(event?.message.text).toBe("not the assistant speaking");
    expect(normalized?.message.text).toBeUndefined();
  });

  test("a malformed question_request is stripped like any other event", async () => {
    // GIVEN a question_request with nothing renderable
    const [event] = await collect(
      normalizeVellumEventStream(
        one({ type: "question_request", text: "junk" }),
      ),
    );

    // THEN it does not leak its stringy field into the transcript
    expect(event?.message.text).toBeUndefined();
  });
});
