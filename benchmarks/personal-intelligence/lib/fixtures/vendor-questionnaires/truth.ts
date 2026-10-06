/**
 * Ground truth for the vendor-questionnaire fixture: the answers a
 * review has to come back with. Derived from `vendors.ts` by
 * `generate.ts`, which prints exactly this key. Regenerate rather than
 * editing here.
 */
import { redFlags, VENDORS } from "./vendors";
import { WIDE_VENDORS } from "./wide";

/** Workspace-relative directory the questionnaires are staged under. */
export const QUESTIONNAIRES_DIR = "questionnaires";

/** How many questionnaires there are — the count the ask names. */
export const VENDOR_COUNT = VENDORS.length;

/** What a correct review says about one vendor. */
export interface VendorTruth {
  vendor: string;
  encryptsAtRest: boolean;
  soc2: boolean;
  /** The red flags this vendor's answers carry; empty for a clean one. */
  flags: string[];
}

/** Every vendor's answers, in fixture order. */
export const VENDOR_TRUTH: VendorTruth[] = VENDORS.map((vendor) => ({
  vendor: vendor.vendor,
  encryptsAtRest: vendor.encryptsAtRest,
  soc2: vendor.soc2,
  flags: redFlags(vendor),
}));

/** The vendors whose answers carry no red flag at all. */
export const CLEAN_VENDORS = VENDOR_TRUTH.filter(
  (vendor) => vendor.flags.length === 0,
).map((vendor) => vendor.vendor);

/** The vendors that fail on encryption at rest — the sharpest question. */
export const NO_ENCRYPTION_AT_REST = VENDOR_TRUTH.filter(
  (vendor) => !vendor.encryptsAtRest,
).map((vendor) => vendor.vendor);

/** Workspace-relative directory the wide arm is staged under. */
export const WIDE_QUESTIONNAIRES_DIR = "questionnaires";

/** How many questionnaires the wide arm holds. */
export const WIDE_VENDOR_COUNT = WIDE_VENDORS.length;

/** Every wide-arm vendor's answers, in fixture order. */
export const WIDE_VENDOR_TRUTH: VendorTruth[] = WIDE_VENDORS.map((vendor) => ({
  vendor: vendor.vendor,
  encryptsAtRest: vendor.encryptsAtRest,
  soc2: vendor.soc2,
  flags: redFlags(vendor),
}));
