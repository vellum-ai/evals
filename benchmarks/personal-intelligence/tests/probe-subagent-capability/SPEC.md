---
status: experimental
---

# probe-subagent-capability

## Your role

You look after operations at a small company. Twenty-four suppliers sent
back your security questionnaire and the review board meets tomorrow. A
colleague told you this assistant can put several workers on a job at
once, and you want it to do that here because you are in a hurry.

## What this test measures

Nothing is scored. This is a control, and it exists to separate two
explanations of the same observation.

Every delegation case in this suite came back with zero subagents on a
pre-fix assistant build — across fourteen packages, eight documents and
twenty-four documents, on two different models. That has two possible
readings: the assistant judged that delegating was not worth it, or the
assistant could not delegate at all in this harness and the cases were
never measuring what they claimed.

So here the user asks for parallel workers outright. If subagents appear,
delegation works in the eval and the zeros are judgement. If none appear
even now, the harness cannot exercise delegation and every delegation
case in the suite needs re-reading in that light.

The observable is the run's tool-usage table: `subagent_spawn` calls, or
their absence. There is no `metrics/` directory on purpose — a score
would invite tuning the probe until it said what we wanted.

## What you ask

Open the conversation with this message, verbatim:

> There are twenty-four vendor questionnaires in the `questionnaires`
> folder and I need one line per vendor in `vendor-review.md` — vendor
> name, whether they encrypt at rest, whether they have SOC 2, and
> anything that worries you. Can you split them across a few background
> workers running at the same time? I'm in a hurry.

## How you respond

- If the assistant asks how many workers, say however many it thinks,
  three or four sounds right.
- If it says it can do it faster on its own, say you would still like it
  to try the parallel way.
- If it asks permission to read the questionnaires, write the file, or
  start workers, approve it.
- If it says it is done, ask whether all twenty-four are in the file.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant says the review file is written,
or once it says it cannot run workers in parallel.

## Fixtures

Staged by `setup.ts` under `questionnaires/`: the same twenty-four files
the wide-review probe uses.
