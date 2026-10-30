/* ── Input limits ────────────────────────────────────────────────────
   Every field on a public form is an untrusted string of unbounded length
   until something says otherwise. Nothing here is clever; the point is that
   the caps live in one file so they can be read, argued with, and changed
   in one place rather than being scattered through the actions.          */

export const LIMITS = {
  title: 120,
  body: 8_000,
  proposal: 2_000,
  note: 4_000,
  review: 4_000,
  path: 200,
  file: 200_000, // ~200KB of text in one file
  filesPerTask: 25,
  bytesPerTask: 1_000_000, // 1MB across all files in one submission
  domains: 5,
  domain: 24,
} as const;

/** Trim and hard-truncate. Silent truncation beats a rejected form for prose. */
export function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length > max ? t.slice(0, max) : t;
}

/**
 * A file path is safe when it names a place *inside* a project and nothing
 * else. Today these strings only ever go into SQLite and back out through
 * React, so neither traversal nor a null byte can do damage — but the moment
 * anything writes them to disk, zips them, or shells out, an unchecked
 * "../../.ssh/authorized_keys" is a real hole. Validating at the boundary
 * costs nothing and means that day never becomes an incident.
 */
export function safePath(input: string): string | null {
  const p = input.trim().replace(/\\/g, '/');
  if (!p || p.length > LIMITS.path) return null;
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) return null; // absolute
  if (/[\x00-\x1f\x7f]/.test(p)) return null; // control characters
  const parts = p.split('/');
  if (parts.some((s) => s === '' || s === '.' || s === '..')) return null;
  return parts.join('/');
}

export type FileInput = { path: string; content: string };

export type FileResult =
  | { ok: true; files: FileInput[] }
  | { ok: false; error: string };

/**
 * Zip the parallel file_path / file_content arrays a form posts into one
 * list, rejecting the whole batch rather than half-accepting it. Both the
 * "paste your files" and "submit your work" paths run through here, so the
 * rules cannot drift apart.
 */
export function filesFrom(paths: string[], contents: string[]): FileResult {
  const files: FileInput[] = [];
  let bytes = 0;

  for (let i = 0; i < paths.length; i++) {
    const raw = paths[i]?.trim() ?? '';
    if (!raw) continue; // an empty row is just an unused textarea

    const path = safePath(raw);
    if (!path) return { ok: false, error: `Not a valid file path: ${raw.slice(0, 40)}` };

    const content = contents[i] ?? '';
    if (content.length > LIMITS.file) return { ok: false, error: `${path} is over 200KB` };

    if (files.some((f) => f.path === path)) return { ok: false, error: `${path} is listed twice` };

    bytes += content.length;
    files.push({ path, content });
  }

  if (files.length > LIMITS.filesPerTask) {
    return { ok: false, error: `At most ${LIMITS.filesPerTask} files at a time` };
  }
  if (bytes > LIMITS.bytesPerTask) return { ok: false, error: 'Those files total over 1MB' };
  return { ok: true, files };
}

/** Domain tags: lowercase, deduplicated, capped in both count and length. */
export function safeDomains(csv: string): string[] {
  const seen = new Set<string>();
  for (const raw of csv.split(',')) {
    const d = raw.trim().toLowerCase().replace(/[^a-z0-9+#.-]/g, '');
    if (d) seen.add(d.slice(0, LIMITS.domain));
    if (seen.size >= LIMITS.domains) break;
  }
  return [...seen];
}
