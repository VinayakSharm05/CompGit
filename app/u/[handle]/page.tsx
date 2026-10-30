import Link from 'next/link';
import { notFound } from 'next/navigation';
import { userByHandle, userHistory, userSkills, userTasks } from '@/lib/queries';
import { levelOf, reliability } from '@/lib/rating';
import { Empty, Label, LevelTag, Panel, Status, ago } from '@/components/ui';

export default async function Profile({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const user = userByHandle(handle);
  if (!user) notFound();

  const skills = userSkills(user.id);
  const history = userHistory(user.id);
  const posted = userTasks(user.id);
  const rel = reliability(user.claims_kept, user.claims_total);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-ink text-[15px]">{user.name}</h1>
        <div className="text-faint text-[12px]">
          @{user.handle} · joined {ago(user.created_at)}
        </div>
        {user.bio ? <p className="text-muted mt-2 max-w-xl leading-relaxed">{user.bio}</p> : null}
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Panel className="p-3">
          <Label>Reliability</Label>
          <div
            className={`text-[20px] tabular-nums mt-1 ${
              rel.pct !== null && rel.pct < 50 ? 'text-del' : 'text-ink'
            }`}
          >
            {rel.pct === null ? '—' : `${rel.pct}%`}
          </div>
          <div className="text-[11px] text-faint">
            {rel.kept} of {rel.total} claims delivered in time
          </div>
        </Panel>

        <Panel className="p-3">
          <Label>Best rating</Label>
          <div className="text-[20px] tabular-nums mt-1 text-ink">
            {skills.length ? Math.round(skills[0].rating) : '—'}
          </div>
          <div className="text-[11px] text-faint">
            {skills.length ? `${skills[0].domain} · ` : ''}
            {skills.length ? <LevelTag level={levelOf(skills[0].rating)} /> : 'unrated'}
          </div>
        </Panel>

        <Panel className="p-3">
          <Label>Tasks posted</Label>
          <div className="text-[20px] tabular-nums mt-1 text-ink">{posted.length}</div>
          <div className="text-[11px] text-faint">as the requester</div>
        </Panel>
      </div>

      <section className="space-y-2">
        <Label>Skills</Label>
        <Panel>
          {skills.length === 0 ? (
            <Empty>No rated domains yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {skills.map((s) => (
                <li key={s.domain} className="px-3 py-2 flex items-center gap-3">
                  <Link href={`/board?domain=${encodeURIComponent(s.domain)}`} className="text-ink hover:text-accent">
                    {s.domain}
                  </Link>
                  <span className="text-[11px] text-faint">
                    {s.matches} decided task{s.matches === 1 ? '' : 's'}
                    {s.matches < 10 ? ' · provisional' : ''}
                  </span>
                  <span className="ml-auto tabular-nums text-ink">{Math.round(s.rating)}</span>
                  <LevelTag level={levelOf(s.rating)} />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </section>

      {/* The audit trail. A rating nobody can inspect is a rating nobody trusts. */}
      <section className="space-y-2">
        <Label>Rating history</Label>
        <Panel>
          {history.length === 0 ? (
            <Empty>Nothing decided yet.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {history.map((h) => {
                const delta = Math.round(h.after) - Math.round(h.before);
                return (
                  <li key={h.id} className="px-3 py-2 flex items-baseline gap-3 text-[12px]">
                    <span className={`tabular-nums w-12 shrink-0 ${delta >= 0 ? 'text-add' : 'text-del'}`}>
                      {delta >= 0 ? '+' : '−'}
                      {Math.abs(delta)}
                    </span>
                    <span className="text-muted">{h.domain}</span>
                    {h.task_id ? (
                      <Link href={`/tasks/${h.task_id}`} className="text-faint hover:text-accent truncate">
                        {h.title ?? `#${h.task_id}`}
                      </Link>
                    ) : (
                      <span className="text-faint">{h.reason}</span>
                    )}
                    <span className="ml-auto text-faint tabular-nums shrink-0">
                      {Math.round(h.before)} → {Math.round(h.after)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </section>

      {posted.length ? (
        <section className="space-y-2">
          <Label>Posted tasks</Label>
          <Panel>
            <ul className="divide-y divide-line">
              {posted.map((t) => (
                <li key={t.id} className="px-3 py-2 flex items-baseline gap-3">
                  <span className="text-faint tabular-nums text-[11px]">#{t.id}</span>
                  <Link href={`/tasks/${t.id}`} className="text-ink hover:text-accent truncate">
                    {t.title}
                  </Link>
                  <span className="ml-auto text-[11px] shrink-0">
                    <Status status={t.status} />
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      ) : null}
    </div>
  );
}
