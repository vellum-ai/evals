---
status: experimental
---

# vendor-questionnaire-review

## Your role

You look after operations at a small company and you are picking tools.
Eight vendors sent back the security questionnaire you mailed them, and
they are eight long files of their own answers. You have a call about it
tomorrow and you want a straight read of what came back. You are not
technical and you do not want to read a hundred and thirty lines of
boilerplate eight times.

You never mention subagents, delegation, parallelism, or tooling, and you
would not know what those words meant in this context.

## What this test measures

The same delegation judgement as the quotes case, moved up the weight
scale. Eight independent items, one artifact each — the shape production
traces fan out over hardest — but here each item is a real read: about a
hundred and thirty lines of questionnaire with the two answers that
matter buried in the middle.

That makes one delegated reading pass defensible. A worker per vendor is
not: eight briefings, eight fresh contexts and eight read-backs for a
thousand lines one agent holds comfortably. The case exists to find the
line between the two, on the shape where an assistant is most tempted to
cross it.

## What you ask

Open the conversation with this message, verbatim:

> Eight vendors sent back the security questionnaire — they're in the
> `questionnaires` folder. Can you go through them and put one line per
> vendor in `vendor-review.md`, in this shape:
> `Vendor name — at rest: yes/no — SOC 2: yes/no — flags: ...`
> Put anything that worries you in the flags bit.

## How you respond

- If the assistant asks what counts as a flag, say anything you would
  want to raise on the call.
- If it asks whether you want detail beyond the one line, say the line is
  enough, and you will ask if you want more.
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

Staged by `setup.ts` under `questionnaires/`: eight returned
questionnaires from the shared vendor-questionnaires fixture in
`benchmarks/personal-intelligence/lib/fixtures/vendor-questionnaires/questionnaires`,
about a hundred and thirty lines each and a thousand lines in total. Each
follows the same section layout, so the answers that differ sit in the
same places under a lot of identical boilerplate — skimming the top of a
file does not answer the question.

Three vendors are clean. Two do not encrypt at rest, three have no
current SOC 2, two disclose a recent breach, and two allow staff access
with no approval trail, so "everything is fine" and "everything is a red
flag" are both wrong.

`vendors.ts` (the definitions), `generate.ts` (the writer) and `truth.ts`
(the answer key) next to the questionnaires are metric ground truth and
are NOT staged. Regenerate with the script rather than editing the files
or `constants.ts` by hand.

## Success criteria (scored by metrics)

- `vendor-review.md` exists and answers both questions correctly for
  every vendor, in the shape the user asked for (`review-correct`,
  scored as the fraction of eight vendors). The answers are buried in
  boilerplate, so a run that skimmed gets them wrong.
- Delegation stays proportionate (`spawn-restraint`): one worker for the
  whole reading pass is within budget, and each spawn past that costs a
  quarter of the score. The metric records which vendors each briefing
  named, so a worker-per-vendor fan-out is visible as what it is.
- Assistant spend and wall-clock land near the case baselines
  (`assistant-cost`, `runtime-efficiency`).
