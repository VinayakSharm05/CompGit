import Link from 'next/link';
import { allDomains, leaderboard } from '@/lib/queries';
import { levelOf, reliability } from '@/lib/rating';
import { Empty, Label, LevelTag, Panel } from '@/components/ui';

export default async function Board({
  searchParams,
}: {
  searchParams: Promise<{ domain?: string }>;
}) {
  const { domain } = await searchParams;
  const domains = allDomains();
  const active = domain && domains.includes(domain) ? domain : undefined;
  const rows = leaderboard(active);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-ink text-[15px]">Board</h1>
          <p className="text-faint text-[12px] mt-0.5 max-w-lg">
            {active
              ? `Ranked by ${active} rating.`
              : 'Ranked by strongest domain, not an average — being excellent at one thing should read as excellence.'}
          </p>
        </div>
        <nav className="flex items-center gap-px text-[12px] flex-wrap">
          <Link
            href="/board"
            className={`px-2 py-1 border rounded-xs ${
              active ? 'border-transparent text-faint hover:text-muted' : 'border-line-2 text-ink bg-panel-2'
            }`}
          >
            overall
          </Link>
          {domains.map((d) => (
            <Link
              key={d}
              href={`/board?domain=${encodeURIComponent(d)}`}
              className={`px-2 py-1 border rounded-xs ${
                active === d
                  ? 'border-line-2 text-ink bg-panel-2'
                  : 'border-transparent text-faint hover:text-muted'
              }`}
            >
              {d}
            </Link>
          ))}
        </nav>
      </div>

      <Panel>
        {rows.length === 0 ? (
          <Empty>Nobody has a rating in this domain yet.</Empty>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line text-left">
                {['', 'who', active ? active : 'best domain', 'rating', 'level', 'reliability', 'accepted'].map(
                  (h, i) => (
                    <th
                      key={i}
                      className={`px-3 py-1.5 font-normal text-[10px] uppercase tracking-[0.14em] text-faint ${
                        i >= 3 ? 'text-right' : ''
                      }`}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const rel = reliability(r.claims_kept, r.claims_total);
                const rating = r.rating === null ? null : Math.round(r.rating);
                return (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-panel-2">
                    <td className="px-3 py-2 text-faint tabular-nums w-8">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/u/${r.handle}`} className="text-ink hover:text-accent">
                        {r.name}
                      </Link>
                      <span className="text-faint text-[11px]"> @{r.handle}</span>
                    </td>
                    <td className="px-3 py-2 text-muted text-[12px]">{r.domain ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {rating ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {rating === null ? (
                        <span className="text-faint">—</span>
                      ) : (
                        <LevelTag level={levelOf(rating)} />
                      )}
                    </td>
                    <td
                      className={`px-3 py-2 text-right tabular-nums ${
                        rel.pct !== null && rel.pct < 50 ? 'text-del' : 'text-muted'
                      }`}
                      title={`${rel.kept} of ${rel.total} claims delivered`}
                    >
                      {rel.pct === null ? '—' : `${rel.pct}%`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted">{r.accepted}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>

      <p className="text-[11px] text-faint leading-relaxed max-w-2xl">
        Rating is Elo against the task itself: difficulty sets the opponent, acceptance is a win.
        A task can only carry you to the top of the tier above its own, so grinding trivial work
        cannot unlock a hard gate. Reliability is separate on purpose — it answers &ldquo;do they
        finish what they claim&rdquo;, which is a different question from &ldquo;can they do
        it&rdquo;.
      </p>
    </div>
  );
}
