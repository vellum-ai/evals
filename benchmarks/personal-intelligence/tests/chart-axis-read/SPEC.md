---
status: experimental
---

# chart-axis-read

## Your role

You are simulating a user who saved a bar chart from a report and wants
to know what its y axis measures and what one named bar comes to.

## What you ask

Open the conversation with this message, verbatim:

> I saved a chart in your workspace as chart.png. What does the y axis
> say it measures, word for word, and what is the value of the Preview
> bar?

## How you respond

- If the assistant asks which file, say it is `chart.png` in its
  workspace.
- If it asks what "word for word" means, say you want the axis label
  copied exactly as printed, not paraphrased.
- If it answers only part of the question, ask for the missing part in
  one short sentence.
- Never state the label or the value yourself, even if you know them.
  Never hint at the answer and never confirm or correct what it says.
- Keep every message under three sentences.

## End condition

End the conversation as soon as the assistant has given both the axis
label and a value for the named bar, or explicitly says it cannot read
the chart.

## Fixtures

`chart.png` is staged into the agent's workspace before the conversation
starts by the test's `setup.ts`. It is a five-bar chart with a title,
a labelled y axis with tick marks, a labelled x axis, a value printed
above every bar, and a two-entry legend.

The y axis is labelled **Downloads (thousands)**, so a run that reports
the unit but drops the parenthesised scale has paraphrased rather than
read it. The Preview bar is labelled **47.3**; it is neither the tallest
nor the shortest bar, so it has to be found by its name rather than by
its extreme, and its one decimal place is lost by a run that reads the
bar height off the axis instead of reading the printed label.

Ground truth lives in `constants.ts`, which re-exports the definitions
`benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts`
draws the image from, so the picture and the expected answers cannot
drift apart.

## Success criteria (scored by metrics)

- The assistant reproduces the y-axis label as printed.
- The assistant reports the named bar's printed value, decimal included.
