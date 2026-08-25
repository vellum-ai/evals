---
status: experimental
---

# ui-verbatim-text

## Your role

You are simulating a user filing a bug report. You screenshotted the
app's settings screen and need two strings off it copied exactly: the
version it is running and the account it is signed in as.

## What you ask

Open the conversation with this message, verbatim:

> I saved a screenshot of the settings screen in your workspace as
> ui-screenshot.png. I need it for a bug report: what is the exact
> version string shown, and what email is it signed in as?

## How you respond

- If the assistant asks which file, say it is `ui-screenshot.png` in its
  workspace.
- If it asks whether you want the build number too, say you want the
  version line exactly as it appears.
- If it answers only part of the question, ask for the missing part in
  one short sentence.
- Never state the version or the email yourself, even if you know them.
  Never hint at the answer and never confirm or correct what it says.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant has given a version string
and an email address, or explicitly says it cannot read the screenshot.

## Fixtures

`ui-screenshot.png` is staged into the agent's workspace before the
conversation starts by the test's `setup.ts`. It is a mock desktop
settings window: a sidebar, an account block, two labelled toggles with
their states, an About section, and a footer line. The graded strings are
printed in the screen's small type, the size a real settings row uses.

The version line is **v3.14.2 (build 8827)**, so a run that reports only
`v3.14.2` has dropped half of what a bug report needs, and one that
writes `V3.14.2` has retyped rather than copied it. The email is
**user@example.com**.

Ground truth lives in `constants.ts`, which re-exports the definitions
`benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts`
draws the image from, so the picture and the expected answers cannot
drift apart.

## Success criteria (scored by metrics)

- The assistant reproduces the version string exactly, case included.
- The assistant reproduces the email address shown.
