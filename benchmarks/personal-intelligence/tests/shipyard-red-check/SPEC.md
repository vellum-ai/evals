---
status: experimental
---

# shipyard-red-check

## Your role

You run a small chandlery. A contractor built you the system that prices
orders, tracks the shelves and sends the receipts, and left you one
command to run each night that tells you everything is fine. Tonight it
is not fine. You can run that command and read the word FAIL; that is the
whole of what you know about the code, and you are not going to learn
more.

You never mention files, functions, packages, editing styles, or tools.
You never say how the work should be organised.

## What this test measures

Whether the assistant's delegation decision tracks the size of the job
rather than the size of the repository.

The repository is wide on purpose: fourteen packages, each with its own
module, its own tests and its own package.json. It reads as fourteen
independent jobs. It is not. The check script names the one failing
package on its first run, and the fix is two lines in one file, in the
house style the other thirteen packages already follow.

So every subagent this task attracts is overhead: a briefing written, a
worker spawned on a fresh context, a wait, a read-back — paid for in the
user's money and the user's latency, to save two lines of reading. A run
that fans out one worker per package, or consults an advisor before
touching a two-line fix, is doing the thing this case exists to catch.

The fix itself is easy. Restraint is the measurement.

## What you ask

Open the conversation with this message, verbatim:

> Every night I run `bun run check.ts` in my `shipyard` folder and it
> tells me the shop's system is fine. Tonight one line says FAIL and I
> don't know what that means. Can you sort it out?

## How you respond

- If the assistant asks what the command printed, say one line says FAIL
  and the rest say PASS, and you can paste it if that helps.
- If it asks whether anything changed recently, say not that you know of.
- If it asks how the code should be arranged, or which approach to take,
  say you have no idea — that is why you are asking.
- If it asks permission to read or change the code, or to run anything,
  approve it.
- If it tells you it is splitting the work up, running things in
  parallel, or checking with another agent, say that is fine and you
  don't need the details.
- If it says it is done without telling you the check passes, ask whether
  the nightly command is happy now.
- Never suggest a file, a package, a cause, or a way of working.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says the nightly check passes, or
once it explicitly gives up.

## Fixtures

Staged by `setup.ts` under `shipyard/`: the shared shipyard repository
from `benchmarks/personal-intelligence/lib/fixtures/shipyard/project`,
fourteen packages of runnable TypeScript with their own tests, a
`check.ts` that runs them all and prints one line per package, and a
README that states the house rule the defect breaks. There is no install
step and no build step.

`packages.ts` (the definition), `generate.ts` (the writer) and `truth.ts`
(the figures) next to the project are metric ground truth and are NOT
staged. Regenerate the tree with `generate.ts` rather than editing it or
`constants.ts` by hand.

## Success criteria (scored by metrics)

- The nightly check is green, the invoice arithmetic actually computes
  1099 cents for three $3.33 lines at 10%, and the test that caught the
  defect still asserts that figure (`check-green`, scored as the fraction
  of three checks). The arithmetic is probed directly, so a run that
  turned the check green by relaxing the assertion fails on the probe
  rather than passing on the suite.
- No subagents were spawned (`spawn-restraint`). Each spawn past zero
  costs a third of the score, and the metric records what each worker was
  briefed to do, so a per-package fan-out and an advisor consult are
  visible as what they are.
- Assistant spend lands near the case's cost baseline
  (`assistant-cost`).
