import { describe, expect, test } from "bun:test";

import { renderTable } from "../text-table";

describe("renderTable", () => {
  test("pads columns to the widest cell, joins with two spaces, trims trailing whitespace", () => {
    const out = renderTable(
      ["id", "species", "n"],
      [
        ["local-retro", "vellum", "3"],
        ["hermes-default", "hermes", "12"],
      ],
    );
    expect(out).toBe(
      [
        "id              species  n",
        "--------------  -------  --",
        "local-retro     vellum   3",
        "hermes-default  hermes   12",
      ].join("\n"),
    );
  });

  test("with no rows, renders just the header and separator at header width", () => {
    expect(renderTable(["a", "bb"], [])).toBe("a  bb\n-  --");
  });

  test("treats missing trailing cells as empty", () => {
    const out = renderTable(
      ["x", "y"],
      [
        ["1", "2"],
        ["3", ""],
      ],
    );
    expect(out).toBe(["x  y", "-  -", "1  2", "3"].join("\n"));
  });
});
