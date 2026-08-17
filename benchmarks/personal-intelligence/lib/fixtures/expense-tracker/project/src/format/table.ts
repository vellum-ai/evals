export type ColumnAlign = "left" | "right";

/**
 * Pad rows into columns joined by two spaces. The last column keeps its
 * natural width so no line carries trailing spaces.
 */
export function formatTable(
  rows: string[][],
  align: ColumnAlign[] = [],
): string {
  const widths: number[] = [];
  for (const row of rows) {
    row.forEach((cell, column) => {
      widths[column] = Math.max(widths[column] ?? 0, cell.length);
    });
  }
  return rows
    .map((row) =>
      row
        .map((cell, column) => {
          if (column === row.length - 1) {
            return cell;
          }
          return align[column] === "right"
            ? cell.padStart(widths[column])
            : cell.padEnd(widths[column]);
        })
        .join("  "),
    )
    .join("\n");
}
