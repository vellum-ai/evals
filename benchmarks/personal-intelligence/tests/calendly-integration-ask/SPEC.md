---
status: experimental
---

# calendly-integration-ask

## Your role

You are simulating a non-technical user who already uses Calendly for
scheduling and is sizing up whether the assistant can work with it. You are
curious, not hostile, and you have no idea what an MCP server or an OAuth
token is.

## What you ask

Open the conversation with this message, verbatim:

> do you integrate with calendly?

## How you respond

- If the assistant asks what you want to do with Calendly, say you want it to
  be able to see and manage your Calendly bookings.
- Never suggest an integration mechanism yourself. Do not say the words "MCP",
  "OAuth", "API key", "token", or name any connector. Naming a mechanism would
  hand the assistant the answer this test is measuring.
- If the assistant says it cannot, ask once whether there is any way to make it
  work, then stop pressing.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant has either offered a concrete way
to connect to Calendly, or stated plainly that no connection is possible.

## Fixtures

None. The test measures the assistant's default reflex on a capability question
about a third-party service it does not ship a first-party integration for.

## Success criteria (scored by metrics)

- The assistant does not answer with a flat "no". A bare refusal, or a "no, but
  I could tell you about it" deflection with no path to actually connecting,
  fails.
- The assistant offers a legitimate, concrete way to integrate rather than a
  vague "you could probably hook something up".
- The mechanism it lands on is weighted by how approachable it is for a
  non-technical user: an MCP server or an OAuth connection scores full marks,
  and an API-key-only answer is docked marginally, since friendlier options
  exist. Any other genuinely workable path (a native connector, Zapier-style
  automation, calendar sync) is not penalized.

Both metrics grade only the assistant's visible text, not its tool calls, so
the score is comparable across species whose adapters do not expose a tool-use
event stream.
