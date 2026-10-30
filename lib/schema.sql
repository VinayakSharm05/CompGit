CREATE TABLE IF NOT EXISTS users (
  id         INTEGER PRIMARY KEY,
  handle     TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  bio        TEXT NOT NULL DEFAULT '',
  claims_kept  INTEGER NOT NULL DEFAULT 0,
  claims_total INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

/* Skill is per-domain, never one global number: a Rust rating should not
   unlock a Tailwind task. */
CREATE TABLE IF NOT EXISTS skills (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  domain  TEXT NOT NULL,
  rating  REAL NOT NULL DEFAULT 1200,
  matches INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, domain)
);

CREATE TABLE IF NOT EXISTS tasks (
  id           INTEGER PRIMARY KEY,
  requester_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL DEFAULT '',
  -- 'files' = requester pasted the code, 'repo' = imported from a public URL
  source_kind  TEXT NOT NULL DEFAULT 'files',
  repo_url     TEXT NOT NULL DEFAULT '',
  domains      TEXT NOT NULL DEFAULT '',   -- comma separated
  difficulty   INTEGER NOT NULL DEFAULT 2, -- 1..4
  min_level    INTEGER NOT NULL DEFAULT 1, -- gate on claiming
  status       TEXT NOT NULL DEFAULT 'open', -- open|claimed|review|done
  claimed_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  claim_expires_at TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_files (
  id      INTEGER PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  path    TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS proposals (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  -- recorded at write time so a later rating change can't rewrite history
  below_gate INTEGER NOT NULL DEFAULT 0,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending|picked|rejected
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (task_id, user_id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id         INTEGER PRIMARY KEY,
  task_id    INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected
  review     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS submission_files (
  id            INTEGER PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  path          TEXT NOT NULL,
  content       TEXT NOT NULL DEFAULT ''
);

/* Append-only audit of every rating move, so a profile can show why a
   number is what it is instead of asking people to trust it. */
CREATE TABLE IF NOT EXISTS rating_events (
  id       INTEGER PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id  INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  domain   TEXT NOT NULL,
  before   REAL NOT NULL,
  after    REAL NOT NULL,
  reason   TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_task ON proposals(task_id);
CREATE INDEX IF NOT EXISTS idx_subs_task ON submissions(task_id);
