import { runAdd } from "./src/commands/add";
import { runList } from "./src/commands/list";
import { runReportMonth } from "./src/commands/report-month";
import { runReportTotal } from "./src/commands/report-total";

const USAGE = [
  "Usage:",
  "  bun run cli.ts add <YYYY-MM-DD> <amount> <note>",
  "  bun run cli.ts list",
  "  bun run cli.ts report month <YYYY-MM>",
  "  bun run cli.ts report total",
].join("\n");

function fail(message: string): never {
  console.error(message);
  console.error(USAGE);
  process.exit(1);
}

function runReport(args: string[]): void {
  const [kind, ...rest] = args;
  if (kind === "month") {
    if (rest.length !== 1) {
      fail("report month takes one month, written YYYY-MM.");
    }
    runReportMonth(rest[0]);
    return;
  }
  if (kind === "total") {
    if (rest.length !== 0) {
      fail("report total takes no further arguments.");
    }
    runReportTotal();
    return;
  }
  fail(`Unknown report: ${kind ?? "(none given)"}.`);
}

function main(argv: string[]): void {
  const [command, ...rest] = argv;
  if (command === "add") {
    if (rest.length !== 3) {
      fail("add takes a date, an amount, and a quoted note.");
    }
    runAdd(rest[0], rest[1], rest[2]);
    return;
  }
  if (command === "list") {
    if (rest.length !== 0) {
      fail("list takes no arguments.");
    }
    runList();
    return;
  }
  if (command === "report") {
    runReport(rest);
    return;
  }
  fail(`Unknown command: ${command ?? "(none given)"}.`);
}

try {
  main(process.argv.slice(2));
} catch (err) {
  console.error((err as Error).message);
  process.exit(1);
}
