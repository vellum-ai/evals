import { describe, expect, test } from "bun:test";

import scoreTotalSumCorrect, {
  type ClaimedTotalExtractor,
} from "../../../benchmarks/personal-intelligence/tests/transaction-sum-from-images/metrics/total-sum-correct";
import {
  appendAssistantEvents,
  appendTranscriptTurn,
  ensureRunArtifacts,
} from "../metrics";

async function freshRunId(name: string): Promise<string> {
  const runId = `test-txsum-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  return runId;
}

/** An extractor that records the answer it saw and returns a fixed total. */
function stubExtractor(total: number | null): {
  extract: ClaimedTotalExtractor;
  seen: string[];
} {
  const seen: string[] = [];
  return {
    seen,
    extract: async (answer) => {
      seen.push(answer);
      return total;
    },
  };
}

describe("transaction-sum-from-images total-sum-correct metric", () => {
  test("scores 1 when the extractor reads the correct total", async () => {
    // GIVEN the assistant answers and the judge extracts $256.93
    const runId = await freshRunId("correct");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: "The total across both screenshots is $256.93.",
      emittedAt: "now",
    });
    const judge = stubExtractor(256.93);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN it earns full marks and reports the claimed total
    expect(result.name).toBe("total-sum-correct");
    expect(result.score).toBe(1);
    expect(result.metadata).toMatchObject({ claimedTotalUsd: 256.93 });
  });

  test("scores 0 on a subset-sum total — the reported failure mode", async () => {
    // GIVEN the assistant summed only some of the transactions correctly
    const runId = await freshRunId("subset");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: "Your transactions add up to $94.55.",
      emittedAt: "now",
    });
    const judge = stubExtractor(94.55);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN it fails with a wrong-total reason
    expect(result.score).toBe(0);
    expect(result.reason).toMatch(/\$94\.55 instead of \$256\.93/);
  });

  test("scores 0 when the answer is off by one cent", async () => {
    // GIVEN a total that differs only in the cent digit
    const runId = await freshRunId("onecent");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: "The total is $256.94.",
      emittedAt: "now",
    });
    const judge = stubExtractor(256.94);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN the cent-exact comparison rejects it
    expect(result.score).toBe(0);
  });

  test("scores 0 when the extractor finds no total claim", async () => {
    // GIVEN the assistant reports it cannot read the images
    const runId = await freshRunId("nototal");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: "I wasn't able to read the screenshots in my workspace.",
      emittedAt: "now",
    });
    const judge = stubExtractor(null);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN it earns no credit with a no-total reason
    expect(result.score).toBe(0);
    expect(result.reason).toMatch(/no combined total/i);
  });

  test("scores 0 with no answer turn, without invoking the judge", async () => {
    // GIVEN a run with no assistant turn at all
    const runId = await freshRunId("empty");
    const judge = stubExtractor(256.93);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN it scores 0 and never calls the (paid) judge
    expect(result.score).toBe(0);
    expect(judge.seen).toHaveLength(0);
  });

  test("judges the folded final message, not a single streamed delta", async () => {
    // GIVEN a Vellum-style run where the final answer arrives as several
    // assistant_text_delta events whose last fragment is only the amount
    const runId = await freshRunId("deltas");
    await appendTranscriptTurn(runId, {
      role: "simulator",
      content: "What do the two screenshots add up to?",
      emittedAt: "2026-01-01T00:00:00.000Z",
    });
    await appendAssistantEvents(runId, [
      {
        message: { type: "assistant_text_delta", text: "All 12 transactions " },
        emittedAt: "2026-01-01T00:00:01.000Z",
      },
      {
        message: { type: "assistant_text_delta", text: "total " },
        emittedAt: "2026-01-01T00:00:02.000Z",
      },
      {
        message: { type: "assistant_text_delta", text: "$256.93." },
        emittedAt: "2026-01-01T00:00:03.000Z",
      },
    ]);
    const judge = stubExtractor(256.93);

    // WHEN the metric scores the run
    const result = await scoreTotalSumCorrect({ runId }, judge.extract);

    // THEN the judge receives the coalesced answer, not the trailing delta
    expect(judge.seen).toHaveLength(1);
    expect(judge.seen[0]).toBe("All 12 transactions total $256.93.");
    expect(result.score).toBe(1);
  });
});
