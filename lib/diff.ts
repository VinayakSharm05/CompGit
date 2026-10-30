import { diffLines } from 'diff';

/* Line-level diff rendered as rows, with long unchanged runs collapsed to a
   few lines of context. Nothing clever — the point is that a reviewer can
   see exactly what changed without scrolling through an untouched file. */

export type Row =
  | { kind: 'ctx' | 'add' | 'del'; text: string; a: number | null; b: number | null }
  | { kind: 'gap'; text: string; a: null; b: null };

export type FileDiff = {
  path: string;
  rows: Row[];
  added: number;
  removed: number;
  status: 'modified' | 'added' | 'unchanged';
};

const CONTEXT = 3;

function splitLines(s: string): string[] {
  const lines = s.split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines;
}

export function fileDiff(path: string, before: string | null, after: string): FileDiff {
  const rows: Row[] = [];
  let added = 0;
  let removed = 0;
  let a = 1;
  let b = 1;

  const parts = diffLines(before ?? '', after);

  for (const part of parts) {
    const lines = splitLines(part.value);
    if (part.added) {
      for (const text of lines) {
        rows.push({ kind: 'add', text, a: null, b: b++ });
        added++;
      }
    } else if (part.removed) {
      for (const text of lines) {
        rows.push({ kind: 'del', text, a: a++, b: null });
        removed++;
      }
    } else {
      for (const text of lines) {
        rows.push({ kind: 'ctx', text, a: a++, b: b++ });
      }
    }
  }

  return {
    path,
    rows: collapse(rows),
    added,
    removed,
    status: before === null ? 'added' : added + removed === 0 ? 'unchanged' : 'modified',
  };
}

/** Replace long runs of untouched lines with a single gap marker. */
function collapse(rows: Row[]): Row[] {
  const keep = new Set<number>();
  rows.forEach((row, i) => {
    if (row.kind === 'ctx') return;
    for (let j = i - CONTEXT; j <= i + CONTEXT; j++) keep.add(j);
  });

  const out: Row[] = [];
  let hidden = 0;
  rows.forEach((row, i) => {
    if (row.kind !== 'ctx' || keep.has(i)) {
      if (hidden > 0) {
        out.push({ kind: 'gap', text: `${hidden} unchanged line${hidden === 1 ? '' : 's'}`, a: null, b: null });
        hidden = 0;
      }
      out.push(row);
    } else {
      hidden++;
    }
  });
  if (hidden > 0) {
    out.push({ kind: 'gap', text: `${hidden} unchanged line${hidden === 1 ? '' : 's'}`, a: null, b: null });
  }
  return out;
}

export function diffAll(
  base: { path: string; content: string }[],
  next: { path: string; content: string }[],
): FileDiff[] {
  const baseMap = new Map(base.map((f) => [f.path, f.content]));
  return next
    .map((f) => fileDiff(f.path, baseMap.has(f.path) ? baseMap.get(f.path)! : null, f.content))
    .filter((d) => d.status !== 'unchanged');
}
