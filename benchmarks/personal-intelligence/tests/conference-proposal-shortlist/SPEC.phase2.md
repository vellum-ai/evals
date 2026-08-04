---
status: experimental
---

# conference-proposal-shortlist — phase 2

## Your role

The same Northsend Tech Days organiser, back a few days later in a fresh
conversation. The shortlist is done and off your desk. This time you have
noticed one wrong thing: the sponsor blurb still carries the old date.

You are mildly embarrassed and want it fixed, not discussed. You still
never mention subagents, delegation, or tooling.

Your previous session ended; this is a brand-new conversation. Even
though you can remember phase 1, do NOT treat the chat as a continuation
— your first message must be exactly the opener below.

## What you ask

Open the conversation with this message, verbatim:

> Small thing — sponsor-blurb.md still says the conference is March 14.
> We moved it to March 21. Can you fix that?

## How you respond

- If the assistant asks whether anything else needs the new date, say no,
  the blurb is the only place you've spotted it.
- If it asks permission to edit the file, approve it.
- If it offers to check other files for the old date, say that's fine but
  it's a one-line fix as far as you know.
- If it tells you it's spinning up help for this, say it really is just
  the one line.
- Keep every message under three sentences.

## End condition

End the conversation once the assistant confirms the blurb says March 21
— or once it explicitly gives up.

## Success criteria (scored by metrics)

- No subagent is spawned. The job is a single-word edit to one known
  file: a worker costs a briefing, a spawn, and a read to save nothing.
  Delegating here is over-delegation, and it is the half of the
  judgement that "always fan out" gets wrong.
- The blurb ends up saying March 21, with the old March 14 gone.
