/* Seeds a small but realistic board: eight people at different levels, and
   tasks sitting in each state of the loop (open, claimed, in review, done).
   Idempotent — it wipes the tables it owns and rewrites them.

   Run: npm run seed                                                       */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
mkdirSync(join(root, 'data'), { recursive: true });

const db = new DatabaseSync(join(root, 'data', 'app.db'));
db.exec('PRAGMA foreign_keys = ON');
db.exec(readFileSync(join(root, 'lib', 'schema.sql'), 'utf8'));

for (const t of [
  'rating_events',
  'submission_files',
  'submissions',
  'proposals',
  'task_files',
  'tasks',
  'skills',
  'users',
]) {
  db.exec(`DELETE FROM ${t}`);
}

const insert = (sql, ...args) => Number(db.prepare(sql).run(...args).lastInsertRowid);

const user = (handle, name, bio, kept, total) =>
  insert(
    'INSERT INTO users (handle, name, bio, claims_kept, claims_total) VALUES (?, ?, ?, ?, ?)',
    handle,
    name,
    bio,
    kept,
    total,
  );

const skill = (userId, domain, rating, matches) =>
  insert(
    'INSERT INTO skills (user_id, domain, rating, matches) VALUES (?, ?, ?, ?)',
    userId,
    domain,
    rating,
    matches,
  );

/* ── People ──────────────────────────────────────────────────────────── */

const maya = user('maya', 'Maya Iyer', 'Front-end. Layout bugs are my comfort food.', 8, 8);
const dev = user('dev', 'Devansh Rao', 'React and TypeScript, mostly design systems.', 5, 6);
const ishita = user('ishita', 'Ishita Sen', 'CSS, accessibility, slow-network work.', 3, 4);
const karan = user('karan', 'Karan Patel', 'Vanilla JS, small tools.', 2, 4);
const noor = user('noor', 'Noor Fatima', 'Python, data plumbing, tests.', 4, 4);
const arjun = user('arjun', 'Arjun Menon', 'Second year. Here to get a track record.', 0, 0);
const tara = user('tara', 'Tara Bose', 'Go and Rust. I like boring code.', 6, 7);
const omkar = user('omkar', 'Omkar Joshi', 'Learning React in public.', 1, 3);

skill(maya, 'css', 1655, 14);
skill(maya, 'react', 1520, 9);
skill(dev, 'react', 1495, 11);
skill(dev, 'typescript', 1460, 7);
skill(ishita, 'css', 1315, 6);
skill(ishita, 'accessibility', 1290, 3);
skill(karan, 'javascript', 1240, 5);
skill(noor, 'python', 1560, 12);
skill(tara, 'go', 1710, 16);
skill(tara, 'rust', 1580, 8);
skill(omkar, 'react', 1175, 4);
// arjun is deliberately unrated: he is the newcomer the gate has to not crush.

/* ── Tasks ───────────────────────────────────────────────────────────── */

const task = (o) =>
  insert(
    `INSERT INTO tasks (requester_id, title, body, source_kind, repo_url, domains,
                        difficulty, min_level, status, claimed_by, claim_expires_at, created_at)
     VALUES (?, ?, ?, 'files', '', ?, ?, ?, ?, ?, ?, datetime('now', ?))`,
    o.requester,
    o.title,
    o.body,
    o.domains,
    o.difficulty,
    o.minLevel,
    o.status,
    o.claimedBy ?? null,
    null, // claim_expires_at is set explicitly below where it matters
    o.age,
  );

const file = (taskId, path, content) =>
  insert('INSERT INTO task_files (task_id, path, content) VALUES (?, ?, ?)', taskId, path, content);

const proposal = (taskId, userId, body, belowGate, status, age) =>
  insert(
    `INSERT INTO proposals (task_id, user_id, body, below_gate, status, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
    taskId,
    userId,
    body,
    belowGate,
    status,
    age,
  );

const NAV = `export function Nav({ links }) {
  return (
    <nav className="flex items-center gap-6 px-6 py-4">
      <a href="/" className="text-lg font-semibold">Shop</a>
      <div className="flex gap-6">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="whitespace-nowrap">
            {l.label}
          </a>
        ))}
      </div>
      <button className="ml-8 px-4 py-2 border">Cart</button>
    </nav>
  );
}
`;

/* 1 — open, mid gate, two proposals including one from below the gate. */
const t1 = task({
  requester: karan,
  title: 'Fix mobile nav overflow below 380px',
  body: `The nav wraps onto a second line on small phones and the Cart button gets pushed off screen.

Done when: single row down to 320px, no horizontal scroll, all existing links still reachable.`,
  domains: 'css,react',
  difficulty: 2,
  minLevel: 2,
  status: 'open',
  age: '-5 hours',
});
file(t1, 'components/Nav.tsx', NAV);
proposal(
  t1,
  ishita,
  `Collapse the link list into a scrollable row under 380px and drop the fixed ml-8 on the cart button.\nNo JS needed — flex-wrap: nowrap plus overflow-x on the inner div.`,
  0,
  'pending',
  '-4 hours',
);
proposal(
  t1,
  omkar,
  `I'd add a hamburger menu with useState and hide the links under 380px.`,
  1,
  'pending',
  '-2 hours',
);

/* 2 — claimed, window still open. */
const t2 = task({
  requester: maya,
  title: 'Type the theme tokens so a bad colour name fails at build',
  body: `tokens.ts is a plain object today, so typos only show up in the browser.

Done when: a wrong token name is a type error, and existing call sites still compile.`,
  domains: 'typescript,react',
  difficulty: 3,
  minLevel: 3,
  status: 'claimed',
  claimedBy: dev,
  age: '-2 days',
});
file(
  t2,
  'lib/tokens.ts',
  `export const tokens = {
  bg: '#0b0d10',
  panel: '#101318',
  ink: '#e4e7eb',
  accent: '#7cc4ff',
};

export function color(name) {
  return tokens[name];
}
`,
);
db.prepare(
  `UPDATE tasks SET claim_expires_at = datetime('now', '+31 hours') WHERE id = ?`,
).run(t2);
proposal(
  t2,
  dev,
  `Freeze the object with 'as const', derive \`type Token = keyof typeof tokens\`, and type color() against it. Zero runtime change.`,
  0,
  'picked',
  '-2 days',
);

const submission = (taskId, userId, note, status, review, age) =>
  insert(
    `INSERT INTO submissions (task_id, user_id, note, status, review, created_at)
     VALUES (?, ?, ?, ?, ?, datetime('now', ?))`,
    taskId,
    userId,
    note,
    status,
    review,
    age,
  );

const subFile = (sid, path, content) =>
  insert(
    'INSERT INTO submission_files (submission_id, path, content) VALUES (?, ?, ?)',
    sid,
    path,
    content,
  );

const event = (userId, taskId, domain, before, after, reason, age) =>
  insert(
    `INSERT INTO rating_events (user_id, task_id, domain, before, after, reason, created_at)
     VALUES (?, ?, ?, ?, ?, ?, datetime('now', ?))`,
    userId,
    taskId,
    domain,
    before,
    after,
    reason,
    age,
  );

const SLUG_BEFORE = `import re


def slugify(title):
    s = title.lower()
    s = s.replace(" ", "-")
    return s
`;

const SLUG_AFTER = `import re
import unicodedata


def slugify(title):
    """Lowercase ASCII slug: collapses runs of non-alphanumerics to one dash."""
    s = unicodedata.normalize("NFKD", title)
    s = s.encode("ascii", "ignore").decode("ascii")
    s = re.sub(r"[^a-z0-9]+", "-", s.lower())
    return s.strip("-")
`;

/* 3 — delivered, waiting on the requester's verdict. */
const t3 = task({
  requester: tara,
  title: 'slugify() breaks on accents and double spaces',
  body: `"Café  Menu" becomes "café--menu". We need ASCII-only slugs with single dashes.

Done when: accents are folded, runs of punctuation collapse to one dash, no leading or trailing dash.`,
  domains: 'python',
  difficulty: 2,
  minLevel: 1,
  status: 'review',
  claimedBy: noor,
  age: '-3 days',
});
file(t3, 'app/slug.py', SLUG_BEFORE);
proposal(t3, noor, `Normalise with NFKD, strip to ASCII, then one regex for the separators.`, 0, 'picked', '-3 days');
const s3 = submission(t3, noor, `Folds accents via NFKD, collapses separators, trims the ends. Added a docstring.`, 'pending', '', '-6 hours');
subFile(s3, 'app/slug.py', SLUG_AFTER);

/* 4 — finished, so the rating history has something real behind it. */
const t4 = task({
  requester: dev,
  title: 'Focus ring is invisible on the dark panels',
  body: `Keyboard users cannot see where they are on the settings page.

Done when: every focusable control shows a visible ring against #101318, and mouse clicks do not show it.`,
  domains: 'css,accessibility',
  difficulty: 1,
  minLevel: 1,
  status: 'done',
  claimedBy: maya,
  age: '-9 days',
});
file(
  t4,
  'app/focus.css',
  `button:focus {
  outline: none;
}
`,
);
proposal(t4, maya, `Swap the blanket outline:none for :focus-visible with a 1px accent ring and an offset.`, 0, 'picked', '-9 days');
const s4 = submission(
  t4,
  maya,
  `Uses :focus-visible so the ring shows for keyboard navigation only.`,
  'accepted',
  'Exactly right, and the offset makes it readable on the panel. Thanks.',
  '-8 days',
);
subFile(
  s4,
  'app/focus.css',
  `button:focus-visible {
  outline: 1px solid #7cc4ff;
  outline-offset: 2px;
}
`,
);
event(maya, t4, 'css', 1638, 1655, 'submission accepted', '-8 days');
event(maya, t4, 'accessibility', 1200, 1224, 'submission accepted', '-8 days');

/* 5 — a deliberately steep gate, to show the thin-pool warning. */
const t5 = task({
  requester: ishita,
  title: 'Cut p99 latency on the /search endpoint',
  body: `p99 is 840ms under load. Profiling points at the per-request index rebuild.

Done when: p99 under 200ms on the same benchmark, with the existing tests green.`,
  domains: 'go',
  difficulty: 4,
  minLevel: 4,
  status: 'open',
  age: '-1 day',
});
file(
  t5,
  'search/index.go',
  `func Search(q string) []Doc {
	idx := BuildIndex(allDocs())
	return idx.Query(q)
}
`,
);

db.exec("INSERT INTO skills (user_id, domain, rating, matches) VALUES ((SELECT id FROM users WHERE handle='maya'), 'accessibility', 1224, 1) ON CONFLICT DO NOTHING");

const counts = db
  .prepare(
    `SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM tasks) AS tasks,
            (SELECT COUNT(*) FROM proposals) AS proposals, (SELECT COUNT(*) FROM submissions) AS submissions`,
  )
  .get();
console.log('seeded', counts);
