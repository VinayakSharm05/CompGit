import { cookies } from 'next/headers';
import { all, one } from './db';
import { levelOf, reliability, type Reliability } from './rating';

/* v1 has no passwords. The cookie holds a seeded user id and the header lets
   you switch between them, so one browser can play requester and several
   contributors while testing the loop. Swapping this file for real auth
   later does not touch anything else. */
const COOKIE = 'cg_user';

export type SessionUser = {
  id: number;
  handle: string;
  name: string;
  bio: string;
  claims_kept: number;
  claims_total: number;
};

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (raw) {
    const u = one<SessionUser>('SELECT * FROM users WHERE id = ?', Number(raw));
    if (u) return u;
  }
  // Fall back to the first seeded account so the app is never a dead end.
  return one<SessionUser>('SELECT * FROM users ORDER BY id LIMIT 1') ?? null;
}

export async function setCurrentUser(id: number) {
  const jar = await cookies();
  jar.set(COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function allUsers(): SessionUser[] {
  return all<SessionUser>('SELECT * FROM users ORDER BY name');
}

/** Skill rating in one domain, defaulting to the starting rating. */
export function ratingIn(userId: number, domain: string): number {
  const row = one<{ rating: number }>(
    'SELECT rating FROM skills WHERE user_id = ? AND domain = ?',
    userId,
    domain,
  );
  return row?.rating ?? 1200;
}

/** Best rating across a task's domains — the number the gate reads. */
export function relevantRating(userId: number, domains: string[]): number {
  if (domains.length === 0) return 1200;
  return Math.max(...domains.map((d) => ratingIn(userId, d)));
}

export function relevantLevel(userId: number, domains: string[]): number {
  return levelOf(relevantRating(userId, domains));
}

export function reliabilityOf(u: SessionUser): Reliability {
  return reliability(u.claims_kept, u.claims_total);
}
