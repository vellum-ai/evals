#!/usr/bin/env bun
// generate.ts — regenerates the CFP fixtures. Run from this directory:
//   bun generate.ts
// Prints the pitch ids for constants.ts. Never hand-edit proposals/.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const TOPICS = [
  "Load-bearing cron jobs and how to retire them",
  "Reading flame graphs without lying to yourself",
  "The migration we did twice",
  "Postgres autovacuum for people who resent it",
  "Type systems as documentation that compiles",
  "What on-call taught me about product scope",
  "Deleting 40% of our test suite on purpose",
  "Feature flags after the launch is over",
  "Caching invalidation in a small team",
  "Why our staging environment kept lying",
  "Rewriting the build without stopping shipping",
  "Observability for things that fail once a month",
  "Schema changes with zero downtime, honestly",
  "The interview loop we deleted",
  "Rate limits as a product decision",
  "Backups nobody has ever restored",
  "Running a monorepo with eleven people",
  "Error budgets in a company that has none",
  "Static analysis that developers do not hate",
  "Onboarding docs that survive contact with reality",
  "Queues, and when a database column is enough",
  "The incident that was a clock problem",
  "Shipping accessibility without a specialist",
  "Retries that made the outage worse",
  "Dependency upgrades as a weekly habit",
  "Local development on a slow laptop",
  "Metrics that changed a roadmap",
  "The refactor we abandoned and why",
  "Pairing remotely without burning out",
  "Config as code, three years later",
  "Blue-green deploys for a stateful service",
  "Estimation, for teams who hate estimating",
  "Postmortems people actually read",
];
// Five unambiguous vendor pitches — each names a product and asks the
// audience to book a demo, so "is this a pitch" needs no judgement call.
const PITCHES: Array<[string, string]> = [
  ["Scaling observability with Lumendeck", "Lumendeck"],
  ["Zero-config CI with Pipeforge", "Pipeforge"],
  ["Cutting cloud spend with Ledgerwise", "Ledgerwise"],
  ["Modern secrets management with Vaultara", "Vaultara"],
  ["Incident response, reimagined with Paginate", "Paginate"],
];

const SPEAKERS = [
  "R. Okonkwo", "M. Deveraux", "T. Lindqvist", "A. Bhattacharya", "J. Moreau",
  "S. Achterberg", "N. Falconer", "P. Vasquez", "K. Yamamoto", "D. Oyelaran",
];

const outDir = join(import.meta.dir, "proposals");
mkdirSync(outDir, { recursive: true });

const pitchIds: string[] = [];
let n = 0;
const write = (title: string, body: string) => {
  n += 1;
  const id = `cfp-${String(n).padStart(3, "0")}`;
  const speaker = SPEAKERS[n % SPEAKERS.length];
  writeFileSync(
    join(outDir, `${id}.md`),
    `# ${id}\n\n**Title:** ${title}\n\n**Speaker:** ${speaker}\n\n**Abstract:**\n${body}\n`,
  );
  return id;
};

// Interleave the pitches through the pile so they are not clustered.
const pitchAt = new Set([4, 11, 19, 26, 33]);
let pitchIdx = 0;
let topicIdx = 0;
for (let slot = 1; slot <= 38; slot += 1) {
  if (pitchAt.has(slot)) {
    const [title, product] = PITCHES[pitchIdx++];
    pitchIds.push(
      write(
        title,
        `${product} is our platform for teams that have outgrown their tooling. ` +
          `This session walks through the ${product} architecture and our pricing tiers. ` +
          `Book a demo of ${product} at the sponsor booth for a free trial.`,
      ),
    );
  } else {
    const topic = TOPICS[topicIdx++ % TOPICS.length];
    write(
      topic,
      `A practitioner talk drawn from production experience. We cover what we ` +
        `tried, what broke, the measurements that changed our minds, and what we ` +
        `would do differently. No vendor content; slides and code will be published.`,
    );
  }
}
console.log(JSON.stringify({ total: n, pitchIds }, null, 2));
