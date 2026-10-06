import { describe, expect, test } from "bun:test";

import { bookNext, hasRoom, type Run } from "./runs";

const WEEK: Run[] = [
  { day: "mon", capacity: 2, booked: 2 },
  { day: "tue", capacity: 2, booked: 1 },
  { day: "wed", capacity: 2, booked: 0 },
];

describe("runs", () => {
  test("a full run has no room", () => {
    expect(hasRoom(WEEK[0])).toBe(false);
    expect(hasRoom(WEEK[1])).toBe(true);
  });

  test("booking takes the first run with room", () => {
    expect(bookNext(WEEK)[1].booked).toBe(2);
  });

  test("a full week refuses the booking", () => {
    expect(() => bookNext([{ day: "fri", capacity: 1, booked: 1 }])).toThrow(
      "full",
    );
  });
});
