import { all, one } from './db';
import { levelOf, meetsReliability, reliability, type Reliability } from './rating';
import { parseDomains, type TaskRow } from './queries';
import { START_RATING } from './rating';

/* ── The claim gate ──────────────────────────────────────────────────
   Deliberately soft. Anyone may write a proposal; the gate only decides
   who may hold an exclusive claim, and a requester can always wave someone
   in by hand. A hard block would strangle supply on a young platform,
   where the pool of qualified people for any given task is tiny.        */

export type Gate = {
  rating: number;
  level: number;
  required: number;
  reliability: Reliability;
  levelOk: boolean;
  reliabilityOk: boolean;
  ok: boolean;
  reasons: string[];
};

/** Best rating among the task's own domains — never a global number. */
export function relevantRating(userId: number, domains: string[]): number {
  if (domains.length === 0) return START_RATING;
  const rows = all<{ rating: number }>(
    `SELECT rating FROM skills
      WHERE user_id = ? AND domain IN (${domains.map(() => '?').join(',')})`,
    userId,
    ...domains,
  );
  return rows.length ? Math.max(...rows.map((r) => r.rating)) : START_RATING;
}

export function gateFor(
  userId: number,
  task: Pick<TaskRow, 'domains' | 'min_level'>,
): Gate {
  const u = one<{ claims_kept: number; claims_total: number }>(
    'SELECT claims_kept, claims_total FROM users WHERE id = ?',
    userId,
  );
  const rel = reliability(u?.claims_kept ?? 0, u?.claims_total ?? 0);
  const rating = relevantRating(userId, parseDomains(task.domains));
  const level = levelOf(rating);
  const required = task.min_level;

  const levelOk = level >= required;
  const reliabilityOk = meetsReliability(rel);
  const reasons: string[] = [];
  if (!levelOk) reasons.push(`needs L${required} in ${task.domains}, you are L${level}`);
  if (!reliabilityOk) reasons.push(`reliability ${rel.pct}% is below the 50% floor`);

  return { rating, level, required, reliability: rel, levelOk, reliabilityOk, ok: levelOk && reliabilityOk, reasons };
}

/** How many people currently clear a task's gate — the liquidity warning. */
export function eligibleCount(task: Pick<TaskRow, 'domains' | 'min_level'>): number {
  const ids = all<{ id: number }>('SELECT id FROM users');
  return ids.filter((u) => gateFor(u.id, task).ok).length;
}
