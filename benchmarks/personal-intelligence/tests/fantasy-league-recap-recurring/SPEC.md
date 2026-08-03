---
status: experimental
---

# fantasy-league-recap-recurring

## Your role

You are simulating the commissioner of the Basement League, a 10-team
fantasy football league. Every Tuesday you post a weekly recap with
standings and the league's running jokes. You have a working setup for
producing it, but you're done running it by hand.

## What you ask

Open the conversation with this message, verbatim:

> Every Tuesday morning I need the weekly recap for my fantasy league
> generated from that week's scores file, same as the previous weeks'
> recaps in your workspace. Set that up to happen every week — and run it
> now for week 8 so I can check it.

## How you respond

- If the assistant asks where things are, say the scores land in scores/
  as week_N.csv and the past recaps are in recaps/.
- If the assistant asks about standings rules, tiebreaks, or what the
  recap should contain, say everything it needs to produce the recap
  correctly is already in the workspace.
- Never explain the tiebreak rules or the recap traditions yourself, and
  never mention that a script exists.
- If the assistant asks permission to read files, run scripts, or create
  the schedule, approve it.
- If the assistant presents the recap only in chat, ask it to save it in
  recaps/ like the previous weeks.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant has both delivered the week 8
recap and confirmed the recurring Tuesday automation is in place — or once
it explicitly gives up.

## Fixtures

Staged into the workspace via `setup.ts`:

- `scores/week_1.csv` … `week_8.csv` — per-matchup decimal scores.
- `scripts/weekly_recap.ts` — the proven generator. It encodes the
  league's non-obvious rules: standings tiebreak by head-to-head then
  FEWEST points against (never points-for), a "Sacko of the Week" callout
  for the lowest scorer, "Juggernaut Watch" for the longest active win
  streak, and a `weekly_recap.ts v7` marker stamped into every recap.
- `recaps/week_6.md`, `recaps/week_7.md` — committed goldens produced by
  actually running the script, demonstrating the exact format.

Week-8 ground truth lives in `constants.ts`. The scores plant two
standings ties that the script's tiebreak rules resolve against the
"obvious" points-for ordering, so a from-scratch re-derivation produces a
plausible but wrong table.

## Success criteria (scored by metrics)

- The week 8 recap matches ground truth: full standings order (including
  both planted tiebreaks), the correct Sacko, and the correct Juggernaut.
- The week 8 run executed `scripts/weekly_recap.ts` rather than
  re-deriving the recap ad hoc.
- A durable recurring schedule exists, firing weekly on Tuesdays.
- The schedule's payload invokes the script (script-mode command, or at
  least an execute-mode prompt that names it) — not a freeform prose
  prompt that re-figures the procedure every week.
