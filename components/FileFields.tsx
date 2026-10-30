'use client';

import { useState } from 'react';
import { Button, Label, inputCls } from './ui';

type Row = { key: number; path: string; content: string };

let seq = 0;
const blank = (): Row => ({ key: ++seq, path: '', content: '' });

/**
 * The in-scope files for a task, or a contributor's edited versions of them.
 * Plain textareas on purpose: a real code editor is a large dependency and
 * buys nothing this loop needs. Paths and contents post as parallel arrays
 * (`file_path` / `file_content`), which the server zips back together.
 */
export function FileFields({
  initial,
  readOnlyPaths = false,
  label = 'Files in scope',
  hint,
}: {
  initial?: { path: string; content: string }[];
  readOnlyPaths?: boolean;
  label?: string;
  hint?: string;
}) {
  const [rows, setRows] = useState<Row[]>(
    initial?.length ? initial.map((f) => ({ ...f, key: ++seq })) : [blank()],
  );

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <Label>{label}</Label>
        {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
      </div>

      {rows.map((row) => (
        <div key={row.key} className="border border-line rounded-xs bg-canvas">
          <div className="flex items-center gap-2 px-2 py-1 border-b border-line bg-panel">
            <input
              name="file_path"
              value={row.path}
              readOnly={readOnlyPaths}
              onChange={(e) => update(row.key, { path: e.target.value })}
              placeholder="src/components/Nav.tsx"
              aria-label="File path"
              className="flex-1 bg-transparent outline-none text-[12px] text-accent placeholder:text-faint"
            />
            {!readOnlyPaths && rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}
                className="text-faint hover:text-del text-[11px] px-1 cursor-pointer"
                aria-label={`Remove ${row.path || 'file'}`}
              >
                remove
              </button>
            ) : null}
          </div>
          <textarea
            name="file_content"
            value={row.content}
            onChange={(e) => update(row.key, { content: e.target.value })}
            spellCheck={false}
            rows={Math.min(28, Math.max(8, row.content.split('\n').length + 1))}
            placeholder="paste the current contents of this file"
            aria-label={`Contents of ${row.path || 'file'}`}
            className="w-full bg-transparent px-2.5 py-2 outline-none resize-y text-[12px] leading-[1.55] placeholder:text-faint"
          />
        </div>
      ))}

      {!readOnlyPaths ? (
        <Button type="button" variant="ghost" onClick={() => setRows((rs) => [...rs, blank()])}>
          + another file
        </Button>
      ) : null}
    </div>
  );
}
