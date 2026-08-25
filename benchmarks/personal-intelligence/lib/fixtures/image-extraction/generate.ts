#!/usr/bin/env bun
/**
 * Write the five image-extraction fixtures under `images/` and print the
 * ground truth they encode. Run this rather than editing the PNGs:
 *
 *   bun benchmarks/personal-intelligence/lib/fixtures/image-extraction/generate.ts
 *
 * Every figure drawn comes from `content.ts`, which the tests' own
 * `constants.ts` files re-export, so an image and the answers it is
 * graded against move together or not at all. The script is idempotent:
 * with `content.ts` unchanged it draws the same pixels, so a changed
 * image after running it means the fixture and the committed ground
 * truth had drifted apart.
 *
 * The drawing itself lives in `images.ts` and the surface it draws on in
 * `png.ts`, a bitmap font and a PNG encoder with no dependencies,
 * because the harness ships none and the fixtures have to be
 * reproducible from this repository alone.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  CHART_ASKED_BAR,
  CHART_Y_AXIS_LABEL,
  formatUsd,
  IMAGES_DIR,
  RECEIPT_LINE_ITEM_COUNT,
  RECEIPT_SUBTOTAL_CENTS,
  RECEIPT_TAX_CENTS,
  RECEIPT_TOTAL_CENTS,
  RECEIPT_TOTAL_QUANTITY,
  TABLE_COLUMNS,
  TABLE_DECIMAL_CELL,
  TABLE_HIGHEST_Q3,
  TABLE_NEGATIVE_CELL,
  UI_EMAIL,
  UI_VERSION_STRING,
} from "./content";
import {
  assertFixtureInvariants,
  FIXTURE_IMAGES,
  MAX_FIXTURE_BYTES,
} from "./images";
import { encodePng } from "./png";

assertFixtureInvariants();

const imagesDir = join(import.meta.dir, IMAGES_DIR);
mkdirSync(imagesDir, { recursive: true });

const written = FIXTURE_IMAGES.map(({ name, draw }) => {
  const canvas = draw();
  const bytes = encodePng(canvas);
  if (bytes.length >= MAX_FIXTURE_BYTES) {
    throw new Error(
      `${name} must stay under ${MAX_FIXTURE_BYTES} bytes (staging rides base64)`,
    );
  }
  writeFileSync(join(imagesDir, name), bytes);
  return {
    name,
    width: canvas.width,
    height: canvas.height,
    bytes: bytes.length,
  };
});

console.log(
  JSON.stringify(
    {
      images: written,
      receipt: {
        lineItemCount: RECEIPT_LINE_ITEM_COUNT,
        totalQuantity: RECEIPT_TOTAL_QUANTITY,
        subtotal: formatUsd(RECEIPT_SUBTOTAL_CENTS),
        tax: formatUsd(RECEIPT_TAX_CENTS),
        total: formatUsd(RECEIPT_TOTAL_CENTS),
      },
      table: {
        negativeCell: TABLE_NEGATIVE_CELL,
        decimalCell: TABLE_DECIMAL_CELL,
        highestQ3: {
          region: TABLE_HIGHEST_Q3.region,
          value: TABLE_HIGHEST_Q3.values[TABLE_COLUMNS.indexOf("Q3")],
        },
      },
      chart: {
        yAxisLabel: CHART_Y_AXIS_LABEL,
        askedBar: CHART_ASKED_BAR,
      },
      ui: { version: UI_VERSION_STRING, email: UI_EMAIL },
    },
    null,
    2,
  ),
);
