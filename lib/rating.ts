/* ── Rating model ────────────────────────────────────────────────────
   Elo, but the "opponent" is the task itself. Accepting a submission is a
   win against a rating derived from the task's difficulty; a rejection is a
   loss. Two separate numbers are tracked per person, because they answer
   different questions:

     skill       — can they do the work?      (per domain, Elo)
     reliability — do they finish what they   (kept claims / taken claims)
                   claim?

   Reliability matters more for the claim gate: most claims fail through
   abandonment, not incompetence.                                       */

export const START_RATING = 1200;

/* Inclusive lower bound of each level. */
const LEVEL_FLOOR = [0, 0, 1250, 1450, 1650] as const;

/* Highest rating a level can hold; the last one is open-ended. */
const LEVEL_CEIL = [0, 1249, 1449, 1649, Infinity] as const;

/* What a task of each difficulty "plays at". */
const DIFFICULTY_RATING = [0, 1150, 1350, 1550, 1750] as const;

export const DIFFICULTY_LABEL = [
  '',
  'trivial',
  'moderate',
  'involved',
  'hard',
] as const;

export function levelOf(rating: number): number {
  if (rating >= LEVEL_FLOOR[4]) return 4;
  if (rating >= LEVEL_FLOOR[3]) return 3;
  if (rating >= LEVEL_FLOOR[2]) return 2;
  return 1;
}

export function clampDifficulty(n: number): number {
  return Math.min(4, Math.max(1, Math.round(n) || 2));
}

function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

/* Provisional players move faster so a new account converges in a few tasks
   instead of a few dozen. */
function kFactor(matches: number): number {
  return matches < 10 ? 40 : 24;
}

/**
 * New rating after a decided submission.
 *
 * Anti-farming rule: a task can only carry you to the top of the tier one
 * above its own. Grinding trivial tasks therefore tops out in low L2 and
 * can never unlock an L4 gate. Losses are never capped.
 */
export function nextRating(
  rating: number,
  matches: number,
  difficulty: number,
  accepted: boolean,
): number {
  const d = clampDifficulty(difficulty);
  const opponent = DIFFICULTY_RATING[d];
  const score = accepted ? 1 : 0;
  const raw = rating + kFactor(matches) * (score - expectedScore(rating, opponent));

  if (!accepted) return Math.round(Math.max(800, raw));

  const cap = LEVEL_CEIL[Math.min(4, d + 1)];
  const ceiling = Math.max(rating, cap); // a cap never drags an existing rating down
  return Math.round(Math.min(raw, ceiling));
}

export type Reliability = { pct: number | null; kept: number; total: number };

export function reliability(kept: number, total: number): Reliability {
  return { pct: total === 0 ? null : Math.round((kept / total) * 100), kept, total };
}

/* Below this, claiming is blocked regardless of skill. Unrated people are
   given the benefit of the doubt so newcomers can start somewhere. */
export const MIN_RELIABILITY = 50;

export function meetsReliability(r: Reliability): boolean {
  return r.pct === null || r.pct >= MIN_RELIABILITY;
}

/** How long a claim is held before it is forfeited. */
export const CLAIM_HOURS = 48;
