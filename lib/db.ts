import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/* One SQLite file, opened once. In dev, Next re-evaluates modules on every
   edit, so the handle is cached on globalThis to avoid piling up connections. */
const DB_PATH = join(process.cwd(), 'data', 'app.db');

declare global {
  var __cgdb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  // A build spins up several worker processes that all open this file at once,
  // so wait for the lock instead of throwing the moment it is contended.
  const db = new DatabaseSync(DB_PATH, { timeout: 8000 });
  try {
    // WAL lets readers and a writer coexist. It is a one-time property of the
    // file, so losing the race to set it is harmless.
    db.exec('PRAGMA journal_mode = WAL');
  } catch {
    /* another process got there first */
  }
  db.exec('PRAGMA foreign_keys = ON');
  migrate(db);
  return db;
}

export const db: DatabaseSync = globalThis.__cgdb ?? (globalThis.__cgdb = open());

function migrate(db: DatabaseSync) {
  // Schema lives in one .sql file so the app and the seed script can never
  // drift apart.
  db.exec(readFileSync(join(process.cwd(), 'lib', 'schema.sql'), 'utf8'));
}

/* Small helpers so callers don't repeat prepare/all/get everywhere.

   node:sqlite hands back rows with a null prototype, and React refuses to
   pass those to a client component. Copying each row into a plain object here
   means no caller has to remember that. */
export function all<T = any>(sql: string, ...params: any[]): T[] {
  return db.prepare(sql).all(...params).map((row) => ({ ...row })) as T[];
}

export function one<T = any>(sql: string, ...params: any[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row === undefined ? undefined : ({ ...row } as T);
}

export function run(sql: string, ...params: any[]) {
  return db.prepare(sql).run(...params);
}
