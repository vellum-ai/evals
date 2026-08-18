#!/usr/bin/env bun
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
    .map((file) => `./${join(src, file)}`);
  const result = Bun.spawnSync(["bun", "test", ...checks], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
  });
  const ok = result.exitCode === 0;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
}

console.log("");
console.log(
  `${packages.length - failed} of ${packages.length} packages passing`,
);
process.exit(failed === 0 ? 0 : 1);
