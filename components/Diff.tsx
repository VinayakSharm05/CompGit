import type { FileDiff } from '@/lib/diff';

/* Unified diff. The `+`/`-` gutter carries the meaning for anyone who cannot
   rely on the colour, and both line numbers stay visible so a reviewer can
   talk about "line 42" and mean it. */
export function Diff({ files }: { files: FileDiff[] }) {
  if (files.length === 0) {
    return <p className="px-3 py-4 text-faint text-[12px]">No changes against the baseline.</p>;
  }

  return (
    <div className="divide-y divide-line">
      {files.map((f) => (
        <div key={f.path}>
          <div className="flex items-center gap-3 px-3 py-1.5 bg-panel-2 border-b border-line">
            <span className="text-accent text-[12px] truncate">{f.path}</span>
            {f.status === 'added' ? (
              <span className="text-[10px] uppercase tracking-wider text-add">new</span>
            ) : null}
            <span className="ml-auto text-[11px] tabular-nums shrink-0">
              <span className="text-add">+{f.added}</span>{' '}
              <span className="text-del">−{f.removed}</span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12px] leading-[1.55]">
              <tbody>
                {f.rows.map((r, i) =>
                  r.kind === 'gap' ? (
                    <tr key={i}>
                      <td colSpan={3} className="px-3 py-0.5 text-faint text-[11px] bg-canvas">
                        ⋯ {r.text}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={i}
                      className={
                        r.kind === 'add'
                          ? 'bg-add/8'
                          : r.kind === 'del'
                            ? 'bg-del/8'
                            : undefined
                      }
                    >
                      <td className="select-none text-right align-top w-10 pr-2 pl-3 text-faint tabular-nums">
                        {r.a ?? ''}
                      </td>
                      <td className="select-none text-right align-top w-10 pr-2 text-faint tabular-nums">
                        {r.b ?? ''}
                      </td>
                      <td
                        className={`pr-3 whitespace-pre align-top ${
                          r.kind === 'add'
                            ? 'text-add'
                            : r.kind === 'del'
                              ? 'text-del'
                              : 'text-muted'
                        }`}
                      >
                        <span className="select-none inline-block w-3 text-faint">
                          {r.kind === 'add' ? '+' : r.kind === 'del' ? '-' : ' '}
                        </span>
                        {r.text || ' '}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
