/* ── Public repo import ──────────────────────────────────────────────
   Read-only, unauthenticated GitHub API. No OAuth app, no tokens, no
   clones on disk: enough to give contributors real project context while
   submissions stay browser-edited diffs.

   Caveat worth knowing: unauthenticated GitHub allows ~60 requests per hour
   per IP. Fine for development; the day this needs more, add a token to
   GITHUB_TOKEN and the header below starts using it.                     */

const NAME = /^[A-Za-z0-9_.-]+$/;

export type RepoRef = { owner: string; repo: string; ref?: string; dir: string };

/** Accepts github.com/owner/repo, .../tree/branch, and .../tree/branch/sub/dir. */
export function parseRepoUrl(input: string): RepoRef | null {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  // Only GitHub, and only over https — this string becomes an outbound fetch.
  if (u.protocol !== 'https:') return null;
  if (u.hostname !== 'github.com' && u.hostname !== 'www.github.com') return null;

  const parts = u.pathname.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const [owner, rawRepo, kind, ref, ...rest] = parts;
  const repo = rawRepo.replace(/\.git$/, '');
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  if (kind && kind !== 'tree') return null;
  if (ref && !NAME.test(ref)) return null;

  return { owner, repo, ref, dir: rest.join('/') };
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'competitive-git',
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

/* Only files a person would plausibly hand-edit in a browser. */
const TEXT_EXT = new Set([
  'ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'css', 'scss', 'sass', 'less',
  'html', 'htm', 'svg', 'json', 'md', 'mdx', 'txt', 'yml', 'yaml', 'toml',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'php', 'c', 'h', 'cpp', 'hpp', 'cs',
  'sql', 'sh', 'vue', 'svelte', 'astro',
]);

const MAX_BYTES = 120_000;
const MAX_LISTED = 500;

export type TreeEntry = { path: string; size: number };

export type TreeResult =
  | { ok: true; ref: string; entries: TreeEntry[]; truncated: boolean }
  | { ok: false; error: string };

export async function fetchTree(r: RepoRef): Promise<TreeResult> {
  try {
    let ref = r.ref;
    if (!ref) {
      const meta = await fetch(`https://api.github.com/repos/${r.owner}/${r.repo}`, {
        headers: headers(),
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      if (!meta.ok) return { ok: false, error: repoError(meta.status) };
      ref = ((await meta.json()) as { default_branch: string }).default_branch;
    }

    const res = await fetch(
      `https://api.github.com/repos/${r.owner}/${r.repo}/git/trees/${ref}?recursive=1`,
      { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return { ok: false, error: repoError(res.status) };

    const body = (await res.json()) as {
      tree: { path: string; type: string; size?: number }[];
      truncated?: boolean;
    };

    const entries = body.tree
      .filter((n) => n.type === 'blob')
      .filter((n) => (r.dir ? n.path.startsWith(`${r.dir}/`) : true))
      .filter((n) => TEXT_EXT.has(n.path.split('.').pop()?.toLowerCase() ?? ''))
      .filter((n) => (n.size ?? 0) <= MAX_BYTES)
      .map((n) => ({ path: n.path, size: n.size ?? 0 }))
      .sort((a, b) => a.path.localeCompare(b.path));

    return {
      ok: true,
      ref,
      entries: entries.slice(0, MAX_LISTED),
      truncated: Boolean(body.truncated) || entries.length > MAX_LISTED,
    };
  } catch {
    return { ok: false, error: 'Could not reach GitHub. Check your connection.' };
  }
}

function repoError(status: number): string {
  if (status === 404) return 'Repository not found, or it is private.';
  if (status === 403) return 'GitHub rate limit reached. Wait a few minutes, or set GITHUB_TOKEN.';
  return `GitHub returned ${status}.`;
}

/** Raw contents of chosen paths. Anything that fails is skipped, not fatal. */
export async function fetchFiles(
  r: RepoRef,
  ref: string,
  paths: string[],
): Promise<{ path: string; content: string }[]> {
  const out: { path: string; content: string }[] = [];
  for (const path of paths.slice(0, 25)) {
    const url = `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${ref}/${path
      .split('/')
      .map(encodeURIComponent)
      .join('/')}`;
    try {
      const res = await fetch(url, { headers: headers(), cache: 'no-store', signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const length = res.headers.get('content-length');
      if (length && Number(length) > MAX_BYTES) continue;
      const text = await res.text();
      if (text.length > MAX_BYTES) continue;
      out.push({ path, content: text });
    } catch {
      /* skip unreadable file */
    }
  }
  return out;
}
