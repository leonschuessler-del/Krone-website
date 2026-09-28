/** Deterministic PRNG so every run produces identical artwork. */
export function mulberry32(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rand = () => number;

export const range = (r: Rand, min: number, max: number) => min + r() * (max - min);
export const pick = <T>(r: Rand, items: readonly T[]): T => items[Math.floor(r() * items.length) % items.length] as T;
