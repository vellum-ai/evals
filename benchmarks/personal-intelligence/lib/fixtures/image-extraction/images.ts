/**
 * The five image-extraction fixtures, as drawing code plus the
 * invariants their ground truth has to satisfy.
 *
 * Split from `generate.ts` so the fixture guard can render an image in
 * memory and compare it against the committed PNG without writing to the
 * repository. `generate.ts` is the runnable half: it calls these, writes
 * `images/`, and prints the ground truth.
 */
import {
  CHART_BARS,
  CHART_IMAGE,
  CHART_SERIES_GENERAL,
  CHART_SERIES_PRE_RELEASE,
  CHART_TITLE,
  CHART_X_AXIS_LABEL,
  CHART_Y_AXIS_LABEL,
  CHART_Y_AXIS_TICKS,
  formatAmount,
  formatTableValue,
  formatUsd,
  lineAmountCents,
  PHOTO_IMAGE,
  RECEIPT_ADDRESS,
  RECEIPT_FOOTER,
  RECEIPT_IMAGE,
  RECEIPT_LINE_ITEM_COUNT,
  RECEIPT_LINE_ITEMS,
  RECEIPT_ORDER_LINE,
  RECEIPT_STORE,
  RECEIPT_SUBTOTAL_CENTS,
  RECEIPT_TAX_CENTS,
  RECEIPT_TAX_RATE,
  RECEIPT_TOTAL_CENTS,
  RECEIPT_TOTAL_QUANTITY,
  TABLE_COLUMNS,
  TABLE_HIGHEST_Q3,
  TABLE_IMAGE,
  TABLE_ROW_HEADER,
  TABLE_ROWS,
  TABLE_TITLE,
  UI_ACCOUNT_NAME,
  UI_EMAIL,
  UI_FOOTER,
  UI_IMAGE,
  UI_SIDEBAR_ITEMS,
  UI_TOGGLES,
  UI_VERSION_STRING,
  UI_WINDOW_TITLE,
} from "./content";
import {
  createCanvas,
  drawText,
  drawTextCentered,
  drawTextRight,
  fillDisc,
  fillRect,
  fillTriangle,
  fillVerticalGradient,
  setPixel,
  strokeRect,
  type Canvas,
  type Rgb,
} from "./png";

const INK: Rgb = [26, 28, 32];
const MUTED: Rgb = [104, 110, 120];
const RULE: Rgb = [176, 182, 190];
const PAPER: Rgb = [253, 252, 249];
const WHITE: Rgb = [255, 255, 255];

/** Assert a fixture invariant, naming what broke. */
function assertFixture(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Fixture invariant violated: ${message}`);
  }
}

// ---------------------------------------------------------------------------
// receipt.png
// ---------------------------------------------------------------------------

export function drawReceipt(): Canvas {
  const canvas = createCanvas(900, 840, PAPER);
  const left = 40;
  const right = 860;
  const qtyRight = 560;
  const eachRight = 700;

  drawTextCentered(canvas, 450, 34, RECEIPT_STORE, INK, 4);
  drawTextCentered(canvas, 450, 92, RECEIPT_ADDRESS, MUTED, 2);
  drawTextCentered(canvas, 450, 120, RECEIPT_ORDER_LINE, MUTED, 2);

  fillRect(canvas, left, 152, right - left, 3, RULE);
  drawText(canvas, left, 168, "ITEM", MUTED, 2);
  drawTextRight(canvas, qtyRight, 168, "QTY", MUTED, 2);
  drawTextRight(canvas, eachRight, 168, "EACH", MUTED, 2);
  drawTextRight(canvas, right, 168, "AMOUNT", MUTED, 2);
  fillRect(canvas, left, 192, right - left, 1, RULE);

  let y = 212;
  for (const item of RECEIPT_LINE_ITEMS) {
    drawText(canvas, left, y, item.name, INK, 3);
    drawTextRight(canvas, qtyRight, y, String(item.quantity), INK, 3);
    drawTextRight(
      canvas,
      eachRight,
      y,
      formatAmount(item.unitPriceCents),
      INK,
      3,
    );
    drawTextRight(
      canvas,
      right,
      y,
      formatAmount(lineAmountCents(item)),
      INK,
      3,
    );
    y += 46;
  }

  fillRect(canvas, left, y + 8, right - left, 1, RULE);
  drawTextRight(canvas, eachRight, y + 30, "SUBTOTAL", MUTED, 3);
  drawTextRight(
    canvas,
    right,
    y + 30,
    formatAmount(RECEIPT_SUBTOTAL_CENTS),
    INK,
    3,
  );
  const taxLabel = `TAX (${(RECEIPT_TAX_RATE * 100).toFixed(2)}%)`;
  drawTextRight(canvas, eachRight, y + 76, taxLabel, MUTED, 3);
  drawTextRight(canvas, right, y + 76, formatAmount(RECEIPT_TAX_CENTS), INK, 3);
  fillRect(canvas, left, y + 118, right - left, 3, RULE);
  drawTextRight(canvas, eachRight - 60, y + 138, "TOTAL", INK, 4);
  drawTextRight(canvas, right, y + 138, formatUsd(RECEIPT_TOTAL_CENTS), INK, 4);

  drawTextCentered(canvas, 450, 790, RECEIPT_FOOTER, MUTED, 2);
  return canvas;
}

// ---------------------------------------------------------------------------
// table.png
// ---------------------------------------------------------------------------

export function drawTable(): Canvas {
  const canvas = createCanvas(900, 460, WHITE);
  const left = 40;
  const top = 100;
  const labelWidth = 168;
  const columnWidth = 166;
  const rowHeight = 48;
  const width = labelWidth + columnWidth * TABLE_COLUMNS.length;
  const height = rowHeight * (TABLE_ROWS.length + 1);

  drawText(canvas, left, 36, TABLE_TITLE, INK, 3);

  fillRect(canvas, left, top, width, rowHeight, [234, 238, 243]);
  drawText(canvas, left + 14, top + 14, TABLE_ROW_HEADER, INK, 3);
  TABLE_COLUMNS.forEach((column, index) => {
    drawTextRight(
      canvas,
      left + labelWidth + columnWidth * (index + 1) - 14,
      top + 14,
      column,
      INK,
      3,
    );
  });

  TABLE_ROWS.forEach((row, rowIndex) => {
    const rowTop = top + rowHeight * (rowIndex + 1);
    drawText(canvas, left + 14, rowTop + 14, row.region, INK, 3);
    row.values.forEach((value, columnIndex) => {
      drawTextRight(
        canvas,
        left + labelWidth + columnWidth * (columnIndex + 1) - 14,
        rowTop + 14,
        formatTableValue(value),
        INK,
        3,
      );
    });
  });

  for (let index = 0; index <= TABLE_ROWS.length + 1; index += 1) {
    fillRect(canvas, left, top + rowHeight * index, width, 1, RULE);
  }
  fillRect(canvas, left, top, 1, height, RULE);
  for (let index = 0; index <= TABLE_COLUMNS.length; index += 1) {
    fillRect(
      canvas,
      left + labelWidth + columnWidth * index,
      top,
      1,
      height,
      RULE,
    );
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// chart.png
// ---------------------------------------------------------------------------

const CHART_COLORS: Record<string, Rgb> = {
  [CHART_SERIES_PRE_RELEASE]: [68, 108, 198],
  [CHART_SERIES_GENERAL]: [38, 148, 96],
};

export function drawChart(): Canvas {
  const canvas = createCanvas(900, 620, WHITE);
  const plotLeft = 160;
  const plotRight = 860;
  const plotTop = 96;
  const plotBottom = 500;
  const axisMax = CHART_Y_AXIS_TICKS[CHART_Y_AXIS_TICKS.length - 1];
  const yFor = (value: number) =>
    plotBottom - (value / axisMax) * (plotBottom - plotTop);

  drawTextCentered(canvas, 450, 28, CHART_TITLE, INK, 3);
  drawText(canvas, 40, 66, CHART_Y_AXIS_LABEL, MUTED, 2);

  for (const tick of CHART_Y_AXIS_TICKS) {
    const y = Math.round(yFor(tick));
    fillRect(canvas, plotLeft, y, plotRight - plotLeft, 1, [226, 230, 236]);
    drawTextRight(canvas, plotLeft - 16, y - 7, tick.toFixed(0), MUTED, 2);
  }

  const slot = (plotRight - plotLeft) / CHART_BARS.length;
  const barWidth = 88;
  CHART_BARS.forEach((bar, index) => {
    const center = plotLeft + slot * (index + 0.5);
    const top = Math.round(yFor(bar.value));
    fillRect(
      canvas,
      Math.round(center - barWidth / 2),
      top,
      barWidth,
      plotBottom - top,
      CHART_COLORS[bar.series],
    );
    drawTextCentered(canvas, center, top - 26, bar.value.toFixed(1), INK, 2);
    drawTextCentered(canvas, center, plotBottom + 18, bar.label, INK, 2);
  });

  fillRect(canvas, plotLeft, plotBottom, plotRight - plotLeft, 3, INK);
  fillRect(canvas, plotLeft, plotTop, 3, plotBottom - plotTop + 3, INK);
  drawTextCentered(
    canvas,
    (plotLeft + plotRight) / 2,
    plotBottom + 56,
    CHART_X_AXIS_LABEL,
    MUTED,
    2,
  );

  const legendLeft = 620;
  const legendTop = 110;
  strokeRect(canvas, legendLeft, legendTop, 226, 78, RULE);
  [CHART_SERIES_PRE_RELEASE, CHART_SERIES_GENERAL].forEach((series, index) => {
    const y = legendTop + 18 + index * 30;
    fillRect(canvas, legendLeft + 14, y, 18, 18, CHART_COLORS[series]);
    drawText(canvas, legendLeft + 42, y + 2, series, INK, 2);
  });
  return canvas;
}

// ---------------------------------------------------------------------------
// ui-screenshot.png
// ---------------------------------------------------------------------------

/** A pill switch: green with the knob right when on, grey and left when off. */
function drawToggle(canvas: Canvas, x: number, y: number, on: boolean): void {
  const width = 64;
  const height = 30;
  const track: Rgb = on ? [52, 168, 106] : [188, 194, 202];
  fillRect(canvas, x + height / 2, y, width - height, height, track);
  fillDisc(canvas, x + height / 2, y + height / 2, height / 2, track);
  fillDisc(canvas, x + width - height / 2, y + height / 2, height / 2, track);
  fillDisc(
    canvas,
    on ? x + width - height / 2 : x + height / 2,
    y + height / 2,
    height / 2 - 4,
    WHITE,
  );
}

export function drawUiScreenshot(): Canvas {
  const canvas = createCanvas(900, 620, [246, 247, 249]);
  const contentLeft = 280;
  const contentRight = 860;

  fillRect(canvas, 0, 0, 900, 56, [226, 229, 234]);
  fillRect(canvas, 0, 56, 900, 1, RULE);
  const dots: Rgb[] = [
    [237, 106, 94],
    [244, 190, 79],
    [98, 197, 84],
  ];
  dots.forEach((color, index) => {
    fillDisc(canvas, 26 + index * 26, 28, 8, color);
  });
  drawTextCentered(canvas, 450, 18, UI_WINDOW_TITLE, INK, 3);

  fillRect(canvas, 0, 57, 240, 563, [236, 238, 242]);
  fillRect(canvas, 240, 57, 1, 563, RULE);
  UI_SIDEBAR_ITEMS.forEach((item, index) => {
    const y = 96 + index * 44;
    if (item === "Account") {
      fillRect(canvas, 12, y - 10, 216, 36, [210, 220, 236]);
    }
    drawText(canvas, 32, y, item, index === 1 ? INK : MUTED, 2);
  });

  drawText(canvas, contentLeft, 92, "ACCOUNT", MUTED, 2);
  drawText(canvas, contentLeft, 118, UI_ACCOUNT_NAME, INK, 3);
  drawText(canvas, contentLeft, 154, UI_EMAIL, MUTED, 2);
  fillRect(canvas, contentLeft, 190, contentRight - contentLeft, 1, RULE);

  UI_TOGGLES.forEach((toggle, index) => {
    const y = 216 + index * 58;
    drawText(canvas, contentLeft, y, toggle.label, INK, 3);
    drawTextRight(canvas, contentRight - 84, y + 4, toggle.state, MUTED, 2);
    drawToggle(canvas, contentRight - 64, y - 4, toggle.state === "On");
  });

  fillRect(canvas, contentLeft, 336, contentRight - contentLeft, 1, RULE);
  drawText(canvas, contentLeft, 360, "ABOUT", MUTED, 2);
  drawText(canvas, contentLeft, 386, "Version", INK, 3);
  drawTextRight(canvas, contentRight, 392, UI_VERSION_STRING, MUTED, 2);
  fillRect(canvas, contentLeft, 434, contentRight - contentLeft, 1, RULE);
  drawText(canvas, contentLeft, 458, "Storage", INK, 3);
  drawTextRight(canvas, contentRight, 464, "1.8 GB of 5 GB used", MUTED, 2);

  drawText(canvas, contentLeft, 572, UI_FOOTER, MUTED, 2);
  return canvas;
}

// ---------------------------------------------------------------------------
// photo.png
// ---------------------------------------------------------------------------

/** Fill every column from the curve down to the bottom of the canvas. */
function fillBelowCurve(
  canvas: Canvas,
  curve: (x: number) => number,
  color: Rgb,
): void {
  for (let x = 0; x < canvas.width; x += 1) {
    const top = Math.round(curve(x));
    for (let y = top; y < canvas.height; y += 1) {
      setPixel(canvas, x, y, color);
    }
  }
}

function drawConifer(
  canvas: Canvas,
  x: number,
  baseY: number,
  size: number,
): void {
  const trunk: Rgb = [92, 68, 46];
  const needle: Rgb = [38, 78, 52];
  fillRect(
    canvas,
    x - size * 0.08,
    baseY - size * 0.2,
    size * 0.16,
    size * 0.24,
    trunk,
  );
  for (let tier = 0; tier < 3; tier += 1) {
    const tierBase = baseY - size * (0.18 + tier * 0.24);
    const halfWidth = size * (0.36 - tier * 0.08);
    fillTriangle(
      canvas,
      [x - halfWidth, tierBase],
      [x + halfWidth, tierBase],
      [x, tierBase - size * 0.42],
      needle,
    );
  }
}

export function drawPhoto(): Canvas {
  const canvas = createCanvas(800, 600, [150, 190, 230]);
  fillVerticalGradient(canvas, 0, 0, 800, 400, [96, 156, 220], [214, 233, 246]);
  fillDisc(canvas, 618, 96, 62, [250, 243, 206]);
  fillDisc(canvas, 618, 96, 44, [255, 232, 150]);

  fillBelowCurve(canvas, (x) => 348 - 42 * Math.sin(x / 240), [152, 174, 158]);
  fillBelowCurve(
    canvas,
    (x) => 412 - 54 * Math.sin(x / 165 + 1.2),
    [110, 142, 112],
  );
  fillBelowCurve(
    canvas,
    (x) => 468 - 34 * Math.sin(x / 118 + 2.6),
    [70, 104, 78],
  );

  for (const [x, size] of [
    [92, 150],
    [206, 118],
    [352, 168],
    [498, 132],
    [666, 156],
  ] as const) {
    drawConifer(canvas, x, 470 - 34 * Math.sin(x / 118 + 2.6) + 30, size);
  }
  return canvas;
}

// ---------------------------------------------------------------------------
// Invariants, write, report
// ---------------------------------------------------------------------------

/**
 * Everything the committed ground truth has to satisfy for the images to
 * be worth grading against. Called by the generator before it writes and
 * by the fixture guard, so a definition edit that breaks one of these
 * fails loudly instead of shipping a fixture nobody can answer.
 */
export function assertFixtureInvariants(): void {
  const summedLineItems = RECEIPT_LINE_ITEMS.reduce(
    (sum, item) => sum + lineAmountCents(item),
    0,
  );
  assertFixture(
    summedLineItems === RECEIPT_SUBTOTAL_CENTS,
    "the receipt line items must sum to the printed subtotal",
  );
  assertFixture(
    RECEIPT_SUBTOTAL_CENTS + RECEIPT_TAX_CENTS === RECEIPT_TOTAL_CENTS,
    "subtotal plus tax must equal the printed total",
  );
  assertFixture(
    RECEIPT_LINE_ITEMS.every(
      (item) => lineAmountCents(item) !== RECEIPT_TOTAL_CENTS,
    ),
    "no line amount may equal the total, or a lucky guess scores",
  );
  assertFixture(
    RECEIPT_LINE_ITEM_COUNT !== RECEIPT_TOTAL_QUANTITY,
    "the line-item count must differ from the summed quantity column",
  );

  const tableValues = TABLE_ROWS.flatMap((row) => row.values);
  assertFixture(
    tableValues.filter((value) => value < 0).length === 1,
    "the table must carry exactly one negative cell",
  );
  assertFixture(
    tableValues.filter((value) => !Number.isInteger(value)).length === 1,
    "the table must carry exactly one non-integer cell",
  );
  const q3Index = TABLE_COLUMNS.indexOf("Q3");
  assertFixture(
    TABLE_ROWS.filter(
      (row) => row.values[q3Index] === TABLE_HIGHEST_Q3.values[q3Index],
    ).length === 1,
    "exactly one region may hold the highest Q3 figure",
  );

  assertFixture(
    new Set(CHART_BARS.map((bar) => bar.label)).size === CHART_BARS.length,
    "chart bar labels must be unique",
  );
  assertFixture(
    CHART_BARS.every(
      (bar) => bar.value <= CHART_Y_AXIS_TICKS[CHART_Y_AXIS_TICKS.length - 1],
    ),
    "every bar must fit inside the plotted y range",
  );
}

/** The committed fixtures, by file name, with how each is drawn. */
export const FIXTURE_IMAGES: ReadonlyArray<{
  name: string;
  draw: () => Canvas;
}> = [
  { name: RECEIPT_IMAGE, draw: drawReceipt },
  { name: TABLE_IMAGE, draw: drawTable },
  { name: CHART_IMAGE, draw: drawChart },
  { name: UI_IMAGE, draw: drawUiScreenshot },
  { name: PHOTO_IMAGE, draw: drawPhoto },
];

/** No fixture may exceed this: staging rides a base64 payload. */
export const MAX_FIXTURE_BYTES = 150_000;
