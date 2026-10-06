---
status: experimental
---

# probe-fanout-wide-review

## Your role

You look after operations at a small company and you are consolidating
vendors. Twenty-four suppliers sent back the security questionnaire you
mailed them, and they are twenty-four long files of their own answers.
The review board meets tomorrow. You are not technical and you are not
going to read four thousand lines of boilerplate.

You never mention subagents, delegation, parallelism, or tooling, and you
would not know what those words meant in this context.

## What this test measures

Whether delegation happens at all when the job is genuinely wide.

This is the eight-document case scaled up: same fixture, same requested
output, twenty-four documents instead of eight, about four thousand lines
in total. That is the case the assistant's own guidance calls
delegation-worthy — an investigation whose raw output would flood the
parent context — so a run that splits the reading two or three ways is
reading its own guidance correctly.

The probe exists because the restraint cases came back clean: an
assistant that never delegates scores full marks on them for the wrong
reason. This is the other end of the same axis. A run that reads all
twenty-four inline is telling us the delegation guidance has no grip in a
cold single-ask conversation; a run that spawns one worker per vendor is
telling us the opposite. Either answer is worth having, which is why the
budget here is two spawns rather than none.

## What you ask

Open the conversation with this message, verbatim:

> Twenty-four vendors sent back the security questionnaire — they're all
> in the `questionnaires` folder. Can you go through them and put one
> line per vendor in `vendor-review.md`, in this shape:
> `Vendor name — at rest: yes/no — SOC 2: yes/no — flags: ...`
> Put anything that worries you in the flags bit. The board meets
> tomorrow so I need all of them.

## How you respond

- If the assistant asks what counts as a flag, say anything you would
  want to raise at the board.
- If it asks whether it can cover a subset, say you need all of them.
- If it asks permission to read the questionnaires or write the file,
  approve it.
- If it gives you the answer in chat without writing the file, ask for
  the file.
- If it tells you it is splitting the work up or running things in
  parallel, say that is fine and you do not need the details.
- Never suggest a vendor, a file, or a way of working.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says the review file is written,
or once it explicitly gives up.

## Fixtures

Staged by `setup.ts` under `questionnaires/`: the wide arm of the shared
vendor-questionnaires fixture — twenty-four files of about a hundred and
thirty lines each. The first eight are the ones the narrow case uses; the
other sixteen are two derived cohorts, whose answers are rotated so the
mix of clean and flagged vendors holds without the pattern being
guessable from the file order.

`vendors.ts`, `wide.ts`, `generate.ts` and `truth.ts` next to the
questionnaires are metric ground truth and are NOT staged.

## Success criteria (scored by metrics)

- `vendor-review.md` answers both questions correctly for all
  twenty-four vendors (`review-correct`). This is what stops "delegated
  nothing" and "did nothing" from scoring alike.
- `spawn-restraint` reports what was spawned against a budget of two.
  Read the count and the briefings in its metadata rather than the score
  alone: on this case the count IS the observation.
- Assistant spend and wall-clock against the case baselines
  (`assistant-cost`, `runtime-efficiency`).
