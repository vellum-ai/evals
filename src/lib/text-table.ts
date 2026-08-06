/** text-table — minimal padded-column table renderer for CLI output. */

/**
 * Render a plain-text table: header row, dash separator, then data rows.
 * Columns are padded to the widest cell and joined with two spaces;
 * trailing whitespace is trimmed per line.
 */
export function renderTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, col) =>
    Math.max(h.length, ...rows.map((row) => row[col]?.length ?? 0)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, col) => c.padEnd(widths[col]))
      .join("  ")
      .trimEnd();
  return [
    line(header),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ].join("\n");
}
