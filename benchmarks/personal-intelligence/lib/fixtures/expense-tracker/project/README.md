# tracker

A small command-line expense tracker. Run everything with `bun` from this
folder.

## Commands

```bash
bun run cli.ts add 2025-03-18 42.10 "farmers market"
bun run cli.ts list
bun run cli.ts report month 2025-03
bun run cli.ts report total
```

`add` takes the date as YYYY-MM-DD, the amount in dollars and cents, and a
note. Quote the note if it has spaces.

## Where the data lives

Entries are kept as JSON in `data/expenses.json`, next to this file. Set
`EXPENSES_FILE` to point the commands at another file instead, which lets
tests and other tooling work on a copy of the data:

```bash
EXPENSES_FILE=/tmp/scratch.json bun run cli.ts list
```

## Tests

```bash
bun test src
```
