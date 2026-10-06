/**
 * Ground truth for the shipyard fixture: what the generated repository
 * is, and what a run has to leave behind. Produced by `generate.ts`,
 * which prints these same figures. Regenerate rather than editing here.
 */
import { DEFECT, PACKAGES } from "./packages";

/** Workspace-relative directory the repository is staged under. */
export const SHIPYARD_DIR = "shipyard";

/** How many packages the repository holds — the breadth of the trap. */
export const PACKAGE_COUNT = PACKAGES.length;

/** Every package directory name, in check-script order. */
export const PACKAGE_NAMES = PACKAGES.map((pkg) => pkg.name).sort();

/** The package whose tests fail as shipped. */
export const FAILING_PACKAGE = DEFECT.package;

/** The file the defect lives in, relative to the repository root. */
export const DEFECT_FILE = DEFECT.file;

/** What the invoice total must come to once the defect is fixed, in cents. */
export const EXPECTED_INVOICE_CENTS = DEFECT.expectedCents;

/** What it comes to while the defect stands. */
export const DEFECTIVE_INVOICE_CENTS = DEFECT.actualCents;

/** The line the check script prints when every package passes. */
export const ALL_PASSING_LINE = `${PACKAGE_COUNT} of ${PACKAGE_COUNT} packages passing`;
