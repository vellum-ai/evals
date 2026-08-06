// Shared by the run-by-hand assets/generate.ts fixture generators.
// The algorithm must stay byte-for-byte stable: committed fixtures are
// regenerated from (seed, algorithm) and must remain byte-identical.

/** Deterministic PRNG (mulberry32) — same seed, same sequence, every run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
