#!/usr/bin/env bun
/**
 * Write `project/` from `packages.ts`, then report what the check script
 * says about it. Run this rather than editing the generated tree:
 *
 *   bun benchmarks/personal-intelligence/lib/fixtures/shipyard/generate.ts
 *
 * The script is idempotent: with `packages.ts` unchanged it writes the
 * same bytes, so a diff after running it means the generated tree and its
 * definition have drifted apart.
 *
 * The generated repository is deliberately wide and shallow — one
 * package per slice of the shop, each with a module and its own tests —
 * and exactly one package fails. See `packages.ts` for why that shape is
 * the point.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { DEFECT, PACKAGES } from "./packages";

const projectDir = join(import.meta.dir, "project");
const packagesDir = join(projectDir, "packages");

function write(path: string, body: string): void {
  writeFileSync(path, body, "utf8");
}

rmSync(packagesDir, { recursive: true, force: true });
mkdirSync(packagesDir, { recursive: true });

for (const pkg of PACKAGES) {
  const dir = join(packagesDir, pkg.name);
  mkdirSync(join(dir, "src"), { recursive: true });
  write(
    join(dir, "package.json"),
    `${JSON.stringify(
      {
        name: `@shipyard/${pkg.name}`,
        version: "0.1.0",
        private: true,
        description: pkg.summary,
        type: "module",
        main: "src/index.ts",
      },
      null,
      2,
    )}\n`,
  );
  write(join(dir, "src", `${pkg.module}.ts`), pkg.source);
  write(join(dir, "src", `${pkg.module}.checks.ts`), pkg.test);
  write(join(dir, "src", "index.ts"), `export * from "./${pkg.module}";\n`);
}

const names = PACKAGES.map((pkg) => pkg.name);

write(
  join(projectDir, "package.json"),
  `${JSON.stringify(
    {
      name: "shipyard",
      version: "0.1.0",
      private: true,
      type: "module",
      workspaces: names.map((name) => `packages/${name}`),
      scripts: { check: "bun run check.ts" },
    },
    null,
    2,
  )}\n`,
);

write(
  join(projectDir, "check.ts"),
  `#!/usr/bin/env bun
/**
 * The nightly check: run every package's tests and print one line per
 * package. Exits non-zero when any package fails.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

const packagesDir = join(import.meta.dir, "packages");
const packages = readdirSync(packagesDir).sort();

let failed = 0;
for (const name of packages) {
  const src = join("packages", name, "src");
  const checks = readdirSync(join(import.meta.dir, src))
    .filter((file) => file.endsWith(".checks.ts"))
    .map((file) => \`./\${join(src, file)}\`);
  const result = Bun.spawnSync(["bun", "test", ...checks], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const ok = result.exitCode === 0;
  if (!ok) failed += 1;
  console.log(\`\${ok ? "PASS" : "FAIL"}  \${name}\`);
}

console.log("");
console.log(\`\${packages.length - failed} of \${packages.length} packages passing\`);
process.exit(failed === 0 ? 0 : 1);
`,
);

write(
  join(projectDir, "README.md"),
  `# shipyard

The shop's system, split into ${names.length} small packages under \`packages/\`.
Each one owns a slice of the shop and carries its own tests.

Everything runs straight from source with \`bun\` — there is no install
step and no build step.

## Running the nightly check

\`\`\`
bun run check.ts
\`\`\`

It runs each package's checks and prints one line per package, then a
count. Any \`FAIL\` line means that package's checks did not pass.

Each module has its checks beside it as \`<module>.checks.ts\`. The check
script names them explicitly, so run the script rather than a bare
\`bun test\`.

## The packages

${PACKAGES.map((pkg) => `- \`${pkg.name}\` — ${pkg.summary}`).join("\n")}

## House rules

Money is integer cents everywhere, and \`core\` owns the arithmetic.
A rate (tax, surcharge) is applied to a total and rounded once, at the
end — never part by part.
`,
);

// The tree is committed, so it has to survive `prettier --check` like
// the rest of the repo. Formatting the written files rather than the
// template strings they came from keeps the definitions readable and the
// output canonical, and keeps this script idempotent either way.
const format = Bun.spawnSync(
  ["bunx", "prettier", "--write", "--log-level", "warn", projectDir],
  { cwd: import.meta.dir, stdout: "pipe", stderr: "pipe" },
);
if (format.exitCode !== 0) {
  throw new Error(
    `prettier failed on the generated tree: ${format.stderr.toString()}`,
  );
}

const check = Bun.spawnSync(["bun", "run", "check.ts"], {
  cwd: projectDir,
  stdout: "pipe",
  stderr: "pipe",
});
const output = check.stdout.toString().trim();
console.log(`wrote ${names.length} packages under project/packages/`);
console.log("");
console.log(output);
console.log("");
console.log(
  `check exit code: ${check.exitCode} (1 is expected: the fixture ships broken)`,
);
console.log(
  `planted defect: ${DEFECT.file} — the invoice total comes to ${DEFECT.actualCents} cents where the test expects ${DEFECT.expectedCents}`,
);
