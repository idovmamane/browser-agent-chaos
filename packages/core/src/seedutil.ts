/**
 * Deterministic per-(session, challenge) seeded helpers used by stageFactory
 * to randomise values/ids/labels. Cheap PRNG — sufficient for non-crypto
 * randomisation. Server-only.
 */

export function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0) || 1;
}

export class Seeded {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 1;
  }
  next(): number {
    this.state = (this.state * 1103515245 + 12345) & 0x7fffffff;
    return this.state;
  }
  pick<T>(arr: T[]): T {
    return arr[this.next() % arr.length];
  }
  /** Pick exactly one element from `arr` and remove it. */
  drawn<T>(arr: T[]): T {
    const idx = this.next() % arr.length;
    const [v] = arr.splice(idx, 1);
    return v;
  }
  intBetween(low: number, highInclusive: number): number {
    return low + (this.next() % (highInclusive - low + 1));
  }
  /** Random 8-char hex token, e.g. for opaque element ids. */
  hex(len = 8): string {
    let out = '';
    while (out.length < len) {
      const r = this.next().toString(16);
      out += r;
    }
    return out.slice(0, len);
  }
  /** Shuffle array in place. */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.next() % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/**
 * Tiny label paraphrase helper. Returns one of `variants` selected by seed.
 * NEVER produces nonsense paraphrases — every variant must be plausible UI
 * copy for the same action.
 */
export function paraphrase(rng: Seeded, variants: string[]): string {
  return rng.pick(variants);
}
