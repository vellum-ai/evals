import { describe, expect, test } from "bun:test";

import { byActor, latest, record } from "./trail";

const TRAIL = [
  { at: 3, actor: "sam", action: "refund" },
  { at: 1, actor: "kim", action: "login" },
  { at: 2, actor: "sam", action: "login" },
];

describe("trail", () => {
  test("recording appends", () => {
    expect(
      record(TRAIL, { at: 4, actor: "kim", action: "logout" }),
    ).toHaveLength(4);
  });

  test("one actor's entries come back oldest first", () => {
    expect(byActor(TRAIL, "sam").map((entry) => entry.at)).toEqual([2, 3]);
  });

  test("the latest entry is the newest one", () => {
    expect(latest(TRAIL)?.action).toBe("refund");
    expect(latest([])).toBeUndefined();
  });
});
