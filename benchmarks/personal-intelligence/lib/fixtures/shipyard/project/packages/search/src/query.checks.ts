import { describe, expect, test } from "bun:test";

import { search, searchSkus } from "./query";

describe("query", () => {
  test("a title match ignores case and spacing", () => {
    expect(searchSkus("  DECK  cleat ")).toEqual(["DC-001"]);
  });

  test("a tag matches too", () => {
    expect(searchSkus("rigging")).toEqual(["RP-020", "SH-008"]);
  });

  test("an empty search matches nothing", () => {
    expect(search("")).toHaveLength(0);
  });
});
