'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db, one, run } from './db';
import { currentUser, setCurrentUser } from './session';
import { expireStaleClaims, parseDomains, type TaskRow } from './queries';
import { CLAIM_HOURS, clampDifficulty, nextRating, START_RATING } from './rating';
import { gateFor } from './gate';
import { fetchFiles, parseRepoUrl } from './github';
import { LIMITS, clip, filesFrom, safeDomains } from './limits';

/* Every mutation lives here. Three rules hold throughout:
   - the caller's identity comes from the cookie, never from the form, so a
     crafted POST cannot act as someone else;
   - anything touching more than one table runs in a transaction;
   - every string off a form is clipped and every path is validated before it
     reaches SQLite — see lib/limits.ts.                                   */

function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const out = fn();
    db.exec('COMMIT');
    return out;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => Number(f.get(k) ?? 0) || 0;

/* ── Session ─────────────────────────────────────────────────────────── */

export async function switchUser(f: FormData) {
  const id = num(f, 'userId');
  if (id) await setCurrentUser(id);
  revalidatePath('/', 'layout');
}

/* ── Creating a task ─────────────────────────────────────────────────── */

export async function createTask(f: FormData) {
  const me = await currentUser();
  if (!me) redirect('/');

  const title = clip(str(f, 'title'), LIMITS.title);
  const body = clip(str(f, 'body'), LIMITS.body);
  const domains = safeDomains(str(f, 'domains'));
  const difficulty = clampDifficulty(num(f, 'difficulty'));
  const minLevel = Math.min(4, Math.max(1, num(f, 'min_level') || 1));
  const kind = str(f, 'source_kind') === 'repo' ? 'repo' : 'files';

  if (!title) redirect('/tasks/new?e=Give+the+task+a+title');
  if (domains.length === 0) redirect('/tasks/new?e=Add+at+least+one+domain+tag');

  /* Gather the in-scope files: either pasted by hand, or pulled from a
     public repo. Downstream, both look identical — one list of files. */
  let files: { path: string; content: string }[] = [];
  let repoUrl = '';

  if (kind === 'repo') {
    repoUrl = str(f, 'repo_url');
    const ref = parseRepoUrl(repoUrl);
    const branch = str(f, 'ref');
    const chosen = f.getAll('paths').map(String).filter(Boolean);
    if (!ref) redirect('/tasks/new?e=That+is+not+a+public+GitHub+repo+URL');
    if (chosen.length === 0) {
      redirect(`/tasks/new?repo=${encodeURIComponent(repoUrl)}&e=Select+at+least+one+file`);
    }
    files = await fetchFiles(ref!, branch || ref!.ref || 'HEAD', chosen);
    if (files.length === 0) redirect('/tasks/new?e=Could+not+read+those+files+from+GitHub');
  } else {
    const result = filesFrom(
      f.getAll('file_path').map(String),
      f.getAll('file_content').map(String),
    );
    if (!result.ok) redirect(`/tasks/new?e=${encodeURIComponent(result.error)}`);
    files = result.files;
  }

  const id = tx(() => {
    const res = run(
      `INSERT INTO tasks (requester_id, title, body, source_kind, repo_url,
                          domains, difficulty, min_level)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      me.id,
      title,
      body,
      kind,
      repoUrl,
      domains.join(','),
      difficulty,
      minLevel,
    );
    const taskId = Number(res.lastInsertRowid);
    for (const file of files) {
      run(
        'INSERT INTO task_files (task_id, path, content) VALUES (?, ?, ?)',
        taskId,
        file.path,
        file.content,
      );
    }
    return taskId;
  });

  revalidatePath('/');
  redirect(`/tasks/${id}`);
}

/* ── Proposals ───────────────────────────────────────────────────────── */

/**
 * Anyone may propose, including people below the gate — their pitch is just
 * flagged and sorted last. This is the soft-gate decision: quality signal
 * without cutting off supply, and an underdog can still win on the strength
 * of their approach.
 */
export async function proposeAction(f: FormData) {
  const me = await currentUser();
  const taskId = num(f, 'task_id');
  const body = clip(str(f, 'body'), LIMITS.proposal);
  if (!me || !taskId) return;

  const task = one<TaskRow>('SELECT * FROM tasks WHERE id = ?', taskId);
  if (!task || task.status !== 'open') return;
  if (task.requester_id === me.id) return; // no proposing on your own task
  if (!body) redirect(`/tasks/${taskId}?e=Write+a+short+approach+first`);

  const gate = gateFor(me.id, task);
  run(
    `INSERT INTO proposals (task_id, user_id, body, below_gate) VALUES (?, ?, ?, ?)
       ON CONFLICT (task_id, user_id) DO UPDATE SET body = excluded.body`,
    taskId,
    me.id,
    body,
    gate.ok ? 0 : 1,
  );
  revalidatePath(`/tasks/${taskId}`);
}

/** Requester picks one proposal; that person gets the exclusive window. */
export async function pickProposalAction(f: FormData) {
  const me = await currentUser();
  const proposalId = num(f, 'proposal_id');
  const override = str(f, 'override') === '1';
  if (!me || !proposalId) return;

  expireStaleClaims();
  const p = one<{ id: number; task_id: number; user_id: number }>(
    'SELECT id, task_id, user_id FROM proposals WHERE id = ?',
    proposalId,
  );
  if (!p) return;
  const task = one<TaskRow>('SELECT * FROM tasks WHERE id = ?', p.task_id);
  if (!task || task.requester_id !== me.id || task.status !== 'open') return;

  const gate = gateFor(p.user_id, task);
  if (!gate.ok && !override) {
    redirect(`/tasks/${task.id}?e=That+contributor+is+below+the+gate`);
  }

  tx(() => {
    run(
      `UPDATE tasks
          SET status = 'claimed', claimed_by = ?,
              claim_expires_at = datetime('now', '+${CLAIM_HOURS} hours')
        WHERE id = ?`,
      p.user_id,
      task.id,
    );
    run("UPDATE proposals SET status = 'picked' WHERE id = ?", p.id);
    run(
      "UPDATE proposals SET status = 'rejected' WHERE task_id = ? AND id != ?",
      task.id,
      p.id,
    );
    // Taking a claim counts against reliability immediately; only delivering
    // it back earns the credit.
    run('UPDATE users SET claims_total = claims_total + 1 WHERE id = ?', p.user_id);
  });

  revalidatePath(`/tasks/${task.id}`);
}

/** Walk away from a claim early: reopens the task, keeps the reliability hit. */
export async function releaseClaimAction(f: FormData) {
  const me = await currentUser();
  const taskId = num(f, 'task_id');
  if (!me || !taskId) return;

  const task = one<TaskRow>('SELECT * FROM tasks WHERE id = ?', taskId);
  if (!task || task.claimed_by !== me.id || task.status !== 'claimed') return;

  tx(() => {
    run(
      `UPDATE tasks SET status = 'open', claimed_by = NULL, claim_expires_at = NULL
        WHERE id = ?`,
      taskId,
    );
    run(
      "UPDATE proposals SET status = 'forfeited' WHERE task_id = ? AND status = 'picked'",
      taskId,
    );
  });
  revalidatePath(`/tasks/${taskId}`);
}

/* ── Delivering and reviewing ────────────────────────────────────────── */

/**
 * Delivering inside the window is what reliability measures, so claims_kept
 * moves here — not on acceptance. Whether the work was any *good* is the
 * skill rating's job, and that is decided in the review below.
 */
export async function submitWorkAction(f: FormData) {
  const me = await currentUser();
  const taskId = num(f, 'task_id');
  const note = clip(str(f, 'note'), LIMITS.note);
  if (!me || !taskId) return;

  expireStaleClaims();
  const task = one<TaskRow>('SELECT * FROM tasks WHERE id = ?', taskId);
  if (!task || task.claimed_by !== me.id || task.status !== 'claimed') {
    redirect(`/tasks/${taskId}?e=Your+claim+is+no+longer+active`);
  }

  const result = filesFrom(
    f.getAll('file_path').map(String),
    f.getAll('file_content').map(String),
  );
  if (!result.ok) redirect(`/tasks/${taskId}/work?e=${encodeURIComponent(result.error)}`);
  const files = result.files;

  tx(() => {
    const res = run(
      'INSERT INTO submissions (task_id, user_id, note) VALUES (?, ?, ?)',
      taskId,
      me.id,
      note,
    );
    const sid = Number(res.lastInsertRowid);
    for (const file of files) {
      run(
        'INSERT INTO submission_files (submission_id, path, content) VALUES (?, ?, ?)',
        sid,
        file.path,
        file.content,
      );
    }
    run("UPDATE tasks SET status = 'review' WHERE id = ?", taskId);
    run('UPDATE users SET claims_kept = claims_kept + 1 WHERE id = ?', me.id);
  });

  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

/**
 * Accept or reject. Either way the skill rating moves, in every domain the
 * task was tagged with, and every move is written to rating_events so a
 * profile can show its own arithmetic rather than asking to be trusted.
 */
export async function decideSubmissionAction(f: FormData) {
  const me = await currentUser();
  const submissionId = num(f, 'submission_id');
  const accept = str(f, 'decision') === 'accept';
  const review = clip(str(f, 'review'), LIMITS.review);
  if (!me || !submissionId) return;

  const sub = one<{ id: number; task_id: number; user_id: number; status: string }>(
    'SELECT id, task_id, user_id, status FROM submissions WHERE id = ?',
    submissionId,
  );
  if (!sub || sub.status !== 'pending') return;

  const task = one<TaskRow>('SELECT * FROM tasks WHERE id = ?', sub.task_id);
  if (!task || task.requester_id !== me.id) return;

  const domains = parseDomains(task.domains);

  tx(() => {
    run(
      'UPDATE submissions SET status = ?, review = ? WHERE id = ?',
      accept ? 'accepted' : 'rejected',
      review,
      sub.id,
    );

    for (const domain of domains) {
      const row = one<{ rating: number; matches: number }>(
        'SELECT rating, matches FROM skills WHERE user_id = ? AND domain = ?',
        sub.user_id,
        domain,
      );
      const before = row?.rating ?? START_RATING;
      const matches = row?.matches ?? 0;
      const after = nextRating(before, matches, task.difficulty, accept);

      run(
        `INSERT INTO skills (user_id, domain, rating, matches) VALUES (?, ?, ?, 1)
           ON CONFLICT (user_id, domain)
           DO UPDATE SET rating = excluded.rating, matches = skills.matches + 1`,
        sub.user_id,
        domain,
        after,
      );
      run(
        `INSERT INTO rating_events (user_id, task_id, domain, before, after, reason)
         VALUES (?, ?, ?, ?, ?, ?)`,
        sub.user_id,
        task.id,
        domain,
        before,
        after,
        accept ? 'submission accepted' : 'submission rejected',
      );
    }

    if (accept) {
      run("UPDATE tasks SET status = 'done' WHERE id = ?", task.id);
    } else {
      // Rejected work reopens the task so someone else can take it on.
      run(
        `UPDATE tasks SET status = 'open', claimed_by = NULL, claim_expires_at = NULL
          WHERE id = ?`,
        task.id,
      );
    }
  });

  revalidatePath(`/tasks/${task.id}`);
  revalidatePath('/board');
}
