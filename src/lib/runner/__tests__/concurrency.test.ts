import { describe, expect, test } from "bun:test";

import { runWithConcurrency } from "../concurrency";

describe("runWithConcurrency", () => {
  test("runs all tasks and returns results in order", async () => {
    const tasks = [1, 2, 3].map((n) => async () => n * 10);
    const result = await runWithConcurrency(tasks, 2);
    expect(result.anyFailed).toBe(false);
    expect(result.settled).toHaveLength(3);
    expect(result.settled[0]).toEqual({ status: "fulfilled", value: 10 });
    expect(result.settled[1]).toEqual({ status: "fulfilled", value: 20 });
    expect(result.settled[2]).toEqual({ status: "fulfilled", value: 30 });
  });

  test("respects concurrency limit", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const tasks = Array.from({ length: 10 }, () => async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Bun.sleep(10);
      inFlight--;
      return inFlight;
    });
    await runWithConcurrency(tasks, 3);
    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  test("handles rejections without short-circuiting", async () => {
    const tasks = [
      async () => "ok",
      async () => {
        throw new Error("boom");
      },
      async () => "also-ok",
    ];
    const result = await runWithConcurrency(tasks, 2);
    expect(result.anyFailed).toBe(true);
    expect(result.settled).toHaveLength(3);
    expect(result.settled[0]).toEqual({ status: "fulfilled", value: "ok" });
    expect(result.settled[1]?.status).toBe("rejected");
    expect(result.settled[2]).toEqual({
      status: "fulfilled",
      value: "also-ok",
    });
  });

  test("workers=1 runs sequentially", async () => {
    const order: number[] = [];
    const tasks = Array.from({ length: 5 }, (_, i) => async () => {
      order.push(i);
      await Bun.sleep(5);
      return i;
    });
    await runWithConcurrency(tasks, 1);
    expect(order).toEqual([0, 1, 2, 3, 4]);
  });

  test("workers<=0 falls back to sequential", async () => {
    const tasks = [async () => 1, async () => 2];
    const result = await runWithConcurrency(tasks, 0);
    expect(result.anyFailed).toBe(false);
    expect(result.settled).toHaveLength(2);
  });

  test("empty task list is a no-op", async () => {
    const result = await runWithConcurrency([], 4);
    expect(result.anyFailed).toBe(false);
    expect(result.settled).toEqual([]);
  });

  test("single task with high concurrency works", async () => {
    const result = await runWithConcurrency([async () => 42], 8);
    expect(result.settled).toEqual([{ status: "fulfilled", value: 42 }]);
  });
});
