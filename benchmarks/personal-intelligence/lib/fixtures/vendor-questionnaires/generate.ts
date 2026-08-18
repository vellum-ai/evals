#!/usr/bin/env bun
/**
 * Write `questionnaires/` from `vendors.ts` and print the answer key
 * `truth.ts` carries. Run this rather than editing either by hand:
 *
 *   bun benchmarks/personal-intelligence/lib/fixtures/vendor-questionnaires/generate.ts
 *
 * The script is idempotent: with the definitions unchanged it writes the
 * same bytes, so a diff after running it means the fixture and the
 * committed ground truth have drifted apart.
 *
 * Each questionnaire is long on purpose — a hundred and forty-odd lines
 * of real-looking answers — so that one of them reads like a job worth
 * handing to somebody. Eight of them still fit in one reading pass.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { redFlags, VENDORS, type VendorFacts } from "./vendors";
import { WIDE_VENDORS } from "./wide";

const dir = join(import.meta.dir, "questionnaires");
const wideDir = join(import.meta.dir, "questionnaires-wide");
for (const target of [dir, wideDir]) {
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
}

const yes = (value: boolean): string => (value ? "Yes" : "No");

/**
 * The filler sections every questionnaire carries. Real questionnaires
 * are mostly boilerplate, and the boilerplate is the point: the answers
 * that matter are buried in it, so skimming the first ten lines does not
 * get you the review.
 */
function boilerplate(vendor: VendorFacts): string {
  return `## 4. Corporate

4.1 Legal entity name: ${vendor.vendor}, Inc.
4.2 Year founded: 2019
4.3 Employees: 40-120
4.4 Primary product: ${vendor.product}
4.5 Support hours: 09:00-18:00 local, business days
4.6 Named security contact: security@${vendor.slug}.example
4.7 Cyber-insurance in force: Yes
4.8 Insurer named on request: Yes

## 5. Development practice

5.1 Source control: Git, hosted
5.2 Code review required before merge: Yes
5.3 Automated tests in CI: Yes
5.4 Dependency scanning: Yes, on every pull request
5.5 Static analysis: Yes
5.6 Secrets scanning in CI: Yes
5.7 Production deploys per week: 5-25
5.8 Rollback procedure documented: Yes
5.9 Change advisory board for production: No; peer review only
5.10 Separate staging environment: Yes
5.11 Staging uses production data: No, synthetic only

## 6. Infrastructure

6.1 Hosting: public cloud, managed regions
6.2 Infrastructure as code: Yes
6.3 Production access requires MFA: Yes
6.4 Bastion or zero-trust proxy: Yes
6.5 Network segmentation between tiers: Yes
6.6 Public administrative endpoints: No
6.7 Vulnerability scanning cadence: weekly
6.8 Patch window for critical CVEs: 7 days
6.9 Penetration test cadence: annual, third party
6.10 Last penetration test: within the last 12 months
6.11 Findings from last test closed: all high and critical

## 7. Availability

7.1 Published uptime target: 99.9%
7.2 Uptime achieved last 12 months: 99.9% or better
7.3 Status page: Yes, public
7.4 Backups: daily, encrypted
7.5 Backup restore tested: Yes, quarterly
7.6 Recovery time objective: 4 hours
7.7 Recovery point objective: 1 hour
7.8 Multi-region failover: partial

## 8. People

8.1 Background checks on hire: Yes
8.2 Security training at onboarding: Yes
8.3 Annual security refresher: Yes
8.4 Phishing simulation programme: Yes
8.5 Offboarding revokes access same day: Yes
8.6 Contractors held to the same policy: Yes
8.7 Device management on staff laptops: Yes
8.8 Full-disk encryption enforced: Yes

## 9. Compliance and legal

9.1 GDPR data processing addendum available: Yes
9.2 Standard contractual clauses offered: Yes
9.3 Sub-processor change notice: 30 days
9.4 Right to audit: on request, once per year
9.5 Data deletion on request: within 30 days
9.6 Data export format: JSON and CSV
9.7 Insurance certificate available: Yes
9.8 Named data protection officer: Yes
`;
}

function render(vendor: VendorFacts): string {
  const flags = redFlags(vendor);
  return `# Vendor security questionnaire — ${vendor.vendor}

Returned by the vendor. Answers are theirs; nothing here has been
verified independently.

## 1. Data handling

1.1 What customer data do you store?
    Account records, usage events, and anything the customer uploads.
1.2 Is customer data encrypted in transit?
    Yes. TLS 1.2 or better on every public endpoint.
1.3 Is customer data encrypted at rest?
    ${yes(vendor.encryptsAtRest)}.${
      vendor.encryptsAtRest
        ? " AES-256 on volumes and object storage, keys held in a managed KMS."
        : " Volumes are not encrypted at rest today. It is on the roadmap for next year; disk-level encryption is available on request for an enterprise plan."
    }
1.4 Where is customer data stored?
    ${vendor.residency}.
1.5 How long is data kept after an account closes?
    ${vendor.retentionDays} days, then deleted from live systems.
1.6 Are backups kept longer than that?
    Backups roll off on the same schedule.
1.7 Do you train models on customer data?
    No.

## 2. Access control

2.1 Who can read customer data internally?
    Support and on-call engineering, scoped to the account under
    investigation.
2.2 Is that access logged and reviewed?
    ${
      vendor.unloggedStaffAccess
        ? "Access is logged. Review is ad hoc, and support staff can open an account without a ticket or an approval step."
        : "Yes. Every read is logged against a ticket, and access requires an approval from a second person."
    }
2.3 Is production access time-bound?
    ${vendor.unloggedStaffAccess ? "No; standing access for the support role." : "Yes; sessions expire after 8 hours."}
2.4 Do you support SSO for customer accounts?
    Yes, SAML and OIDC.
2.5 Do you support SCIM provisioning?
    Yes.
2.6 Are customer API keys hashed at rest?
    Yes.

## 3. Certifications and incidents

3.1 Do you hold a current SOC 2 Type II report?
    ${
      vendor.soc2
        ? "Yes. Report available under NDA, covering the last 12 months."
        : "No. A readiness assessment is under way; no report is available yet."
    }
3.2 ISO 27001?
    No.
3.3 Have you had a security incident affecting customer data in the last
    two years?
    ${
      vendor.recentBreach
        ? "Yes. One incident, disclosed to affected customers; a misconfigured storage bucket exposed a subset of account metadata. Remediated, and a post-mortem is available on request."
        : "No."
    }
3.4 How many sub-processors do you use?
    ${vendor.subprocessors}.
3.5 Is the sub-processor list public?
    Yes.
3.6 Do you notify customers of incidents, and how fast?
    Yes, within 72 hours of confirming an incident.

${boilerplate(vendor)}
## 10. Anything else

${
  flags.length === 0
    ? "Nothing further. Happy to walk through any of the above on a call."
    : "Happy to discuss any of the above on a call."
}
`;
}

for (const vendor of VENDORS) {
  writeFileSync(join(dir, `${vendor.slug}.md`), render(vendor), "utf8");
}
for (const vendor of WIDE_VENDORS) {
  writeFileSync(join(wideDir, `${vendor.slug}.md`), render(vendor), "utf8");
}

// The questionnaires are committed, so they have to survive
// `prettier --check` like the rest of the repo. Formatting what was
// written keeps the template readable and the output canonical, and
// leaves this script idempotent either way.
for (const target of [dir, wideDir]) {
  const format = Bun.spawnSync(
    ["bunx", "prettier", "--write", "--log-level", "warn", target],
    { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
  );
  if (format.exitCode !== 0) {
    throw new Error(
      `prettier failed on ${target}: ${format.stderr.toString()}`,
    );
  }
}

console.log(`wrote ${VENDORS.length} questionnaires under questionnaires/`);
console.log(
  `wrote ${WIDE_VENDORS.length} questionnaires under questionnaires-wide/`,
);
console.log("");
console.log("Answer key (copy into truth.ts):");
for (const vendor of VENDORS) {
  const flags = redFlags(vendor);
  console.log(
    `  ${vendor.vendor.padEnd(20)} at-rest=${yes(vendor.encryptsAtRest).padEnd(3)} soc2=${yes(vendor.soc2).padEnd(3)} flags=${flags.length === 0 ? "none" : flags.join("; ")}`,
  );
}
