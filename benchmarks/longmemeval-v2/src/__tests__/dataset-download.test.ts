import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { relabelQuestions } from "../dataset-download";

const LABELED_ID = "deadbeef";
const NICE_NAME = "q-nice-name";
const UNLABELED_ID = "cafef00d";

/** Build a temp dataRoot with labels, questions, and a small haystack. */
async function makeDataRoot(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "lme-v2-download-"));
  await mkdir(join(dir, "haystacks"), { recursive: true });
  await writeFile(
    join(dir, "question-labels.json"),
    JSON.stringify({ [LABELED_ID]: NICE_NAME }),
    "utf8",
  );
  await writeFile(
    join(dir, "questions.jsonl"),
    [
      JSON.stringify({ id: LABELED_ID, question: "Q1?", answer: "A1" }),
      JSON.stringify({ id: UNLABELED_ID, question: "Q2?", answer: "A2" }),
    ].join("\n") + "\n",
    "utf8",
  );
  await writeFile(
    join(dir, "haystacks", "lme_v2_small.json"),
    JSON.stringify({ [LABELED_ID]: ["t1", "t2"], [UNLABELED_ID]: ["t3"] }),
    "utf8",
  );
  return dir;
}

describe("relabelQuestions", () => {
  test("relabels questions and re-keys the small haystack", async () => {
    const dir = await makeDataRoot();

    // No lme_v2_medium.json — its absence must be skipped, not thrown.
    await relabelQuestions(dir);

    const lines = (await readFile(join(dir, "questions.jsonl"), "utf8"))
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map((l) => JSON.parse(l) as Record<string, unknown>);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      id: NICE_NAME,
      originalId: LABELED_ID,
      question: "Q1?",
      answer: "A1",
    });
    // Unlabeled line passes through untouched.
    expect(lines[1]).toEqual({
      id: UNLABELED_ID,
      question: "Q2?",
      answer: "A2",
    });
    expect(lines[1]).not.toHaveProperty("originalId");

    const haystack = JSON.parse(
      await readFile(join(dir, "haystacks", "lme_v2_small.json"), "utf8"),
    ) as Record<string, string[]>;
    expect(haystack).toEqual({
      [NICE_NAME]: ["t1", "t2"],
      [UNLABELED_ID]: ["t3"],
    });
  });

  test("is idempotent: a second pass leaves files byte-identical", async () => {
    const dir = await makeDataRoot();

    await relabelQuestions(dir);
    const questionsAfterFirst = await readFile(
      join(dir, "questions.jsonl"),
      "utf8",
    );
    const haystackAfterFirst = await readFile(
      join(dir, "haystacks", "lme_v2_small.json"),
      "utf8",
    );

    await relabelQuestions(dir);
    expect(await readFile(join(dir, "questions.jsonl"), "utf8")).toBe(
      questionsAfterFirst,
    );
    expect(
      await readFile(join(dir, "haystacks", "lme_v2_small.json"), "utf8"),
    ).toBe(haystackAfterFirst);
  });

  test("rejects when question-labels.json is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lme-v2-download-"));
    await expect(relabelQuestions(dir)).rejects.toThrow(
      `question-labels.json not found at ${join(dir, "question-labels.json")}`,
    );
  });

  test("rejects when questions.jsonl is missing", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lme-v2-download-"));
    await writeFile(join(dir, "question-labels.json"), "{}", "utf8");
    await expect(relabelQuestions(dir)).rejects.toThrow(
      `questions.jsonl not found at ${join(dir, "questions.jsonl")}`,
    );
  });
});
