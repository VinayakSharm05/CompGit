import { all, one, run } from './db';

export type TaskRow = {
  id: number;
  requester_id: number;
  title: string;
  body: string;
  source_kind: 'files' | 'repo';
  repo_url: string;
  domains: string;
  difficulty: number;
  min_level: number;
  status: 'open' | 'claimed' | 'review' | 'done';
  claimed_by: number | null;
  claim_expires_at: string | null;
  created_at: string;
};

export type TaskCard = TaskRow & {
  requester_handle: string;
  claimer_handle: string | null;
  proposal_count: number;
};

export function parseDomains(csv: string): string[] {
  return csv
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Release claims whose 48h window has passed. Run on read instead of on a
 * schedule: no cron, no background worker, and the state is always correct
 * by the time anyone looks at it. The forfeited claim still counts against
 * the claimer's reliability, because claims_total was incremented when they
 * took it and claims_kept never will be.
 */
export function expireStaleClaims(): void {
  const stale = all<{ id: number; claimed_by: number | null }>(
    `SELECT id, claimed_by FROM tasks
      WHERE status = 'claimed' AND claim_expires_at IS NOT NULL
        AND claim_expires_at < datetime('now')`,
  );
  for (const t of stale) {
    run(
      `UPDATE tasks SET status = 'open', claimed_by = NULL, claim_expires_at = NULL
        WHERE id = ?`,
      t.id,
    );
    run(
      `UPDATE proposals SET status = 'forfeited'
        WHERE task_id = ? AND status = 'picked'`,
      t.id,
    );
  }
}

const CARD_SELECT = `
  SELECT t.*, r.handle AS requester_handle, c.handle AS claimer_handle,
         (SELECT COUNT(*) FROM proposals p WHERE p.task_id = t.id) AS proposal_count
    FROM tasks t
    JOIN users r ON r.id = t.requester_id
    LEFT JOIN users c ON c.id = t.claimed_by`;

export function listTasks(status?: string): TaskCard[] {
  expireStaleClaims();
  const where = status && status !== 'all' ? 'WHERE t.status = ?' : '';
  const sql = `${CARD_SELECT} ${where} ORDER BY t.created_at DESC, t.id DESC`;
  return status && status !== 'all' ? all(sql, status) : all(sql);
}

export function getTask(id: number): TaskCard | undefined {
  expireStaleClaims();
  return one(`${CARD_SELECT} WHERE t.id = ?`, id);
}

export type FileRow = { id: number; path: string; content: string };

export function taskFiles(taskId: number): FileRow[] {
  return all('SELECT id, path, content FROM task_files WHERE task_id = ? ORDER BY path', taskId);
}

export type ProposalRow = {
  id: number;
  task_id: number;
  user_id: number;
  body: string;
  below_gate: number;
  status: 'pending' | 'picked' | 'rejected' | 'forfeited';
  created_at: string;
  handle: string;
  name: string;
};

export function taskProposals(taskId: number): ProposalRow[] {
  return all(
    `SELECT p.*, u.handle, u.name FROM proposals p
       JOIN users u ON u.id = p.user_id
      WHERE p.task_id = ?
      ORDER BY p.below_gate ASC, p.created_at ASC`,
    taskId,
  );
}

export type SubmissionRow = {
  id: number;
  task_id: number;
  user_id: number;
  note: string;
  status: 'pending' | 'accepted' | 'rejected';
  review: string;
  created_at: string;
  handle: string;
  name: string;
};

export function taskSubmissions(taskId: number): SubmissionRow[] {
  return all(
    `SELECT s.*, u.handle, u.name FROM submissions s
       JOIN users u ON u.id = s.user_id
      WHERE s.task_id = ? ORDER BY s.created_at DESC`,
    taskId,
  );
}

export function submissionFiles(submissionId: number): FileRow[] {
  return all(
    'SELECT id, path, content FROM submission_files WHERE submission_id = ? ORDER BY path',
    submissionId,
  );
}

/* ── Leaderboard & profiles ─────────────────────────────────────────── */

export type BoardRow = {
  id: number;
  handle: string;
  name: string;
  claims_kept: number;
  claims_total: number;
  rating: number | null;
  domain: string | null;
  accepted: number;
};

/**
 * Ranked by best domain rating, not by a global average: being excellent at
 * one thing should read as excellence, not be diluted by domains you never
 * touch. Passing a domain ranks within that domain instead.
 */
export function leaderboard(domain?: string): BoardRow[] {
  const accepted = `(SELECT COUNT(*) FROM submissions x
                      WHERE x.user_id = u.id AND x.status = 'accepted')`;
  if (domain) {
    return all(
      `SELECT u.id, u.handle, u.name, u.claims_kept, u.claims_total,
              s.rating AS rating, s.domain AS domain, ${accepted} AS accepted
         FROM users u JOIN skills s ON s.user_id = u.id AND s.domain = ?
        ORDER BY s.rating DESC, accepted DESC`,
      domain,
    );
  }
  return all(
    `SELECT u.id, u.handle, u.name, u.claims_kept, u.claims_total,
            (SELECT MAX(rating) FROM skills s WHERE s.user_id = u.id) AS rating,
            (SELECT s.domain FROM skills s WHERE s.user_id = u.id
              ORDER BY s.rating DESC LIMIT 1) AS domain,
            ${accepted} AS accepted
       FROM users u
      ORDER BY rating DESC NULLS LAST, accepted DESC`,
  );
}

export function allDomains(): string[] {
  return all<{ domain: string }>(
    'SELECT DISTINCT domain FROM skills ORDER BY domain',
  ).map((r) => r.domain);
}

export type SkillRow = { domain: string; rating: number; matches: number };

export function userByHandle(handle: string) {
  return one<{
    id: number;
    handle: string;
    name: string;
    bio: string;
    claims_kept: number;
    claims_total: number;
    created_at: string;
  }>('SELECT * FROM users WHERE handle = ?', handle);
}

export function userSkills(userId: number): SkillRow[] {
  return all(
    'SELECT domain, rating, matches FROM skills WHERE user_id = ? ORDER BY rating DESC',
    userId,
  );
}

export type HistoryRow = {
  id: number;
  domain: string;
  before: number;
  after: number;
  reason: string;
  created_at: string;
  task_id: number | null;
  title: string | null;
};

/** The audit trail behind a rating, newest first. */
export function userHistory(userId: number, limit = 25): HistoryRow[] {
  return all(
    `SELECT e.id, e.domain, e.before, e.after, e.reason, e.created_at,
            e.task_id, t.title
       FROM rating_events e
       LEFT JOIN tasks t ON t.id = e.task_id
      WHERE e.user_id = ?
      ORDER BY e.id DESC LIMIT ?`,
    userId,
    limit,
  );
}

export function userTasks(userId: number): TaskCard[] {
  return all(`${CARD_SELECT} WHERE t.requester_id = ? ORDER BY t.id DESC`, userId);
}
