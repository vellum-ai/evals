---
status: experimental
---

# transaction-sum-from-images

## Your role

You are simulating a user who has already shared two phone screenshots of
their card transactions with the assistant and wants the total spend across
everything shown.

## What you ask

Open the conversation with this message, verbatim:

> I saved two screenshots of my recent card transactions in your workspace
> as IMG_0821.png and IMG_0822.jpg. Calculate the total sum of all the
> transactions across both screenshots.

## How you respond

- If the assistant asks which files, say they are the two screenshots saved
  in its workspace as `IMG_0821.png` and `IMG_0822.jpg`.
- If the assistant asks whether to include the pending transaction or the
  partially visible bottom row, say to include every transaction shown.
- Never volunteer any amount yourself, even if you know them. Never hint at
  the answer or correct its arithmetic.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant states a total dollar amount —
or explicitly says it cannot read the screenshots.

## Fixtures

Two real phone screenshots (`assets/IMG_0821.png`, `assets/IMG_0822.jpg`) are
staged into the agent's workspace before the conversation starts, via the
test's `setup.ts` `stage-workspace-file` commands (base64 — they are binary).
Together they show 12 dark-mode "MANGIA 23RD - DOWNTOWN ITALIAN..." card
transactions totalling **$256.93** (see `constants.ts` for the per-row
amounts).

The images are deliberately hostile to sloppy extraction:

- `IMG_0821.png` has 10 rows including one marked **Pending** (still a
  transaction) and a bottom row cut off by the screen edge — its amount
  ($13.72) is visible but its date is not.
- Every row also shows a rewards-points line ("81 pts") that must not be
  mistaken for an amount.
- `IMG_0822.jpg` shows 2 further transactions from the same merchant.

Provenance: user-feedback report from 2026-07-15 — the assistant extracted
only a subset of the transaction values from these exact screenshots (its
arithmetic over the extracted subset was correct; the extraction was not).
The reporter approved using her screenshots as eval fixtures.

## Success criteria (scored by metrics)

- The assistant reports the correct total ($256.93) across all 12
  transactions in both screenshots.
