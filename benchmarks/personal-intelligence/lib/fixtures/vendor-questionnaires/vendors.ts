/**
 * The vendor-questionnaire fixture: eight security questionnaires, each
 * long enough to look like a job of its own.
 *
 * This is the shape production traces fan out over hardest — a request
 * naming N independent items and asking for one artifact per item, where
 * each item is substantial enough that delegating it sounds sensible.
 * The quotes fixture next door is the same shape with trivial items; this
 * one raises the weight per item while keeping the total inside a single
 * reading pass, so a fan-out is still eight briefings against work one
 * agent can hold.
 *
 * `generate.ts` writes the questionnaires from these definitions and
 * prints the answer key. Regenerate rather than editing either side.
 */

/** The answers a reviewer has to come back with, per vendor. */
export interface VendorFacts {
  /** File basename under `questionnaires/`, without the extension. */
  slug: string;
  vendor: string;
  /** What the vendor sells, one line. */
  product: string;
  /** Whether customer data is encrypted at rest. */
  encryptsAtRest: boolean;
  /** Whether they hold a current SOC 2 Type II report. */
  soc2: boolean;
  /** How many subprocessors they list. */
  subprocessors: number;
  /** Whether they disclose a breach in the last two years. */
  recentBreach: boolean;
  /** Where customer data is stored. */
  residency: string;
  /** How long they keep data after an account closes. */
  retentionDays: number;
  /** Whether staff can access customer data without an approval trail. */
  unloggedStaffAccess: boolean;
}

export const VENDORS: VendorFacts[] = [
  {
    slug: "arbor-analytics",
    vendor: "Arbor Analytics",
    product: "Product analytics and funnel reporting",
    encryptsAtRest: true,
    soc2: true,
    subprocessors: 6,
    recentBreach: false,
    residency: "United States (us-east-1, us-west-2)",
    retentionDays: 30,
    unloggedStaffAccess: false,
  },
  {
    slug: "beacon-billing",
    vendor: "Beacon Billing",
    product: "Subscription billing and invoicing",
    encryptsAtRest: true,
    soc2: true,
    subprocessors: 11,
    recentBreach: false,
    residency: "United States and Ireland",
    retentionDays: 90,
    unloggedStaffAccess: false,
  },
  {
    slug: "cedarpost-mail",
    vendor: "Cedarpost Mail",
    product: "Transactional and marketing email delivery",
    encryptsAtRest: false,
    soc2: false,
    subprocessors: 4,
    recentBreach: false,
    residency: "United States (single region)",
    retentionDays: 365,
    unloggedStaffAccess: true,
  },
  {
    slug: "driftwood-support",
    vendor: "Driftwood Support",
    product: "Helpdesk and shared inbox",
    encryptsAtRest: true,
    soc2: false,
    subprocessors: 9,
    recentBreach: true,
    residency: "Germany (eu-central-1)",
    retentionDays: 180,
    unloggedStaffAccess: false,
  },
  {
    slug: "eastgate-identity",
    vendor: "Eastgate Identity",
    product: "Single sign-on and directory sync",
    encryptsAtRest: true,
    soc2: true,
    subprocessors: 3,
    recentBreach: false,
    residency: "United States, Ireland, Australia",
    retentionDays: 14,
    unloggedStaffAccess: false,
  },
  {
    slug: "flintlock-storage",
    vendor: "Flintlock Storage",
    product: "Object storage and file delivery",
    encryptsAtRest: true,
    soc2: true,
    subprocessors: 2,
    recentBreach: true,
    residency: "United States (three regions)",
    retentionDays: 7,
    unloggedStaffAccess: false,
  },
  {
    slug: "goldfinch-crm",
    vendor: "Goldfinch CRM",
    product: "Sales pipeline and contact management",
    encryptsAtRest: false,
    soc2: true,
    subprocessors: 14,
    recentBreach: false,
    residency: "United States, with support access from three countries",
    retentionDays: 730,
    unloggedStaffAccess: true,
  },
  {
    slug: "harborline-logs",
    vendor: "Harborline Logs",
    product: "Log aggregation and alerting",
    encryptsAtRest: true,
    soc2: false,
    subprocessors: 8,
    recentBreach: false,
    residency: "United States (us-east-1)",
    retentionDays: 45,
    unloggedStaffAccess: false,
  },
];

/**
 * The red flags a reviewer is asked to call out. A vendor with none of
 * these is a clean review; the fixture holds three clean vendors so the
 * answer is not "everything is a red flag".
 */
export function redFlags(vendor: VendorFacts): string[] {
  const flags: string[] = [];
  if (!vendor.encryptsAtRest) flags.push("no encryption at rest");
  if (!vendor.soc2) flags.push("no current SOC 2 Type II");
  if (vendor.recentBreach) flags.push("a breach in the last two years");
  if (vendor.unloggedStaffAccess)
    flags.push("staff access with no approval trail");
  return flags;
}
