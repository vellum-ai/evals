/**
 * Detecting drafted HTML/SVG inside a block of text.
 *
 * The pathology this benchmark exists to measure is the model composing
 * the whole fragment in its reasoning channel and only then copying it
 * into the tool call. Reasoning *about* a visual ("a bar chart would
 * read better here than a table") is fine and expected; reasoning that
 * contains `<svg viewBox="0 0 400 200">` is the failure.
 *
 * So the detector looks for markup tokens, not for the words "chart" or
 * "svg". Two families:
 *
 *  - element openers and closers, restricted to a known tag list and
 *    required to be followed by whitespace, `/`, or `>`, so prose like
 *    "if x < g then" cannot trip it;
 *  - attribute fragments that essentially only occur in markup
 *    (`style="`, `viewBox=`, `xmlns=`, …).
 *
 * Volume is attributed by line: a line that contains any markup token
 * counts entirely as markup. A drafted fragment is markup line after
 * markup line, so the line is the honest unit - counting only the
 * matched token would report a 40-line SVG as a few hundred characters.
 */

const TAG_NAMES = [
  "svg",
  "g",
  "path",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "defs",
  "text",
  "tspan",
  "foreignobject",
  "marker",
  "div",
  "span",
  "section",
  "article",
  "header",
  "footer",
  "main",
  "table",
  "thead",
  "tbody",
  "tr",
  "td",
  "th",
  "ul",
  "ol",
  "li",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "style",
  "script",
  "button",
  "input",
  "canvas",
  "img",
  "a",
  "strong",
  "em",
  "br",
  "hr",
].join("|");

const MARKUP_PATTERNS: RegExp[] = [
  // Opening tag from the known list, e.g. `<svg ` / `<div>` / `<br/>`.
  new RegExp(`<(?:${TAG_NAMES})(?=[\\s/>])`, "gi"),
  // Any closing tag, e.g. `</g>` / `</div>`.
  /<\/[a-z][\w-]*\s*>/gi,
  // Attribute fragments that essentially only occur inside markup.
  /\bstyle="/gi,
  /\bclass="/gi,
  /\bviewBox=/gi,
  /\bxmlns=/gi,
  /\b(?:stroke|fill|stroke-width|stroke-linecap|transform)=["']/gi,
];

export interface MarkupMeasurement {
  /** Whether any markup token was found at all. */
  present: boolean;
  /** Number of markup tokens matched. */
  tokenCount: number;
  /** Characters on lines that contain markup. */
  markupChars: number;
  /** Characters in the text overall, markup or not. */
  totalChars: number;
  /**
   * A short excerpt of the first markup-bearing line, for the metric's
   * `reason` string. Clipped so a metrics.json row stays readable.
   */
  sample?: string;
}

/** Clip length for the excerpt surfaced in metric reasons. */
const SAMPLE_CLIP = 160;

function countMatches(text: string): number {
  let total = 0;
  for (const pattern of MARKUP_PATTERNS) {
    // `matchAll` needs the global flag, which every pattern above has;
    // the iterator resets `lastIndex` so the shared regexes stay safe
    // to reuse across calls.
    total += [...text.matchAll(pattern)].length;
  }
  return total;
}

function hasMarkup(line: string): boolean {
  return MARKUP_PATTERNS.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(line);
  });
}

export function measureMarkup(text: string): MarkupMeasurement {
  const totalChars = text.length;
  const tokenCount = countMatches(text);
  if (tokenCount === 0) {
    return { present: false, tokenCount: 0, markupChars: 0, totalChars };
  }

  let markupChars = 0;
  let sample: string | undefined;
  for (const line of text.split("\n")) {
    if (!hasMarkup(line)) continue;
    markupChars += line.length;
    if (sample === undefined) {
      const trimmed = line.trim();
      sample =
        trimmed.length > SAMPLE_CLIP
          ? `${trimmed.slice(0, SAMPLE_CLIP)}…`
          : trimmed;
    }
  }

  return { present: true, tokenCount, markupChars, totalChars, sample };
}
