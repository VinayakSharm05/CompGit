import Link from 'next/link';
import { listTasks, parseDomains } from '@/lib/queries';
import { DIFFICULTY_LABEL } from '@/lib/rating';
import { Empty, LevelTag, Panel, Status, Tag, ago, hoursLeft } from '@/components/ui';

const FILTERS = ['open', 'claimed', 'review', 'done', 'all'] as const;

export default async function TaskBoard({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = 'open' } = await searchParams;
  const active = (FILTERS as readonly string[]).includes(status) ? status : 'open';
  const tasks = listTasks(active);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-ink text-[15px]">Tasks</h1>
          <p className="text-faint text-[12px] mt-0.5 max-w-lg">
            One contributor holds a claim at a time. Propose an approach, get picked, deliver
            inside the window.
          </p>
        </div>
        <nav className="flex items-center gap-px text-[12px]">
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={`/?status=${f}`}
              className={`px-2 py-1 border rounded-xs ${
                active === f
                  ? 'border-line-2 text-ink bg-panel-2'
                  : 'border-transparent text-faint hover:text-muted'
              }`}
            >
              {f}
            </Link>
          ))}
        </nav>
      </div>

      <Panel>
        {tasks.length === 0 ? (
          <Empty>
            Nothing {active === 'all' ? 'here' : active} yet.{' '}
            <Link href="/tasks/new" className="text-accent hover:underline">
              Post a task
            </Link>
            .
          </Empty>
        ) : (
          <ul>
            {tasks.map((t, i) => (
              <li key={t.id} className={i > 0 ? 'border-t border-line' : ''}>
                <Link
                  href={`/tasks/${t.id}`}
                  className="block px-3 py-2.5 hover:bg-panel-2 transition-colors"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="text-faint text-[11px] tabular-nums w-8 shrink-0">
                      #{t.id}
                    </span>
                    <span className="text-ink flex-1 min-w-0 truncate">{t.title}</span>
                    <span className="text-[11px] shrink-0">
                      <Status status={t.status} />
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 mt-1.5 pl-11 flex-wrap text-[11px] text-faint">
                    {parseDomains(t.domains).map((d) => (
                      <Tag key={d}>{d}</Tag>
                    ))}
                    <span title="Task difficulty">{DIFFICULTY_LABEL[t.difficulty]}</span>
                    <span title="Minimum level required to claim">
                      gate <LevelTag level={t.min_level} />+
                    </span>
                    <span>
                      {t.proposal_count} proposal{t.proposal_count === 1 ? '' : 's'}
                    </span>
                    {t.status === 'claimed' ? (
                      <span className="text-warn">
                        {hoursLeft(t.claim_expires_at)}h left · {t.claimer_handle}
                      </span>
                    ) : null}
                    <span className="ml-auto">
                      @{t.requester_handle} · {ago(t.created_at)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
