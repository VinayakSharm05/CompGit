import Link from 'next/link';
import { allUsers, currentUser, reliabilityOf } from '@/lib/session';
import { UserSwitch } from './UserSwitch';

export async function Header() {
  const me = await currentUser();
  const users = allUsers();
  const rel = me ? reliabilityOf(me) : null;

  return (
    <header className="border-b border-line sticky top-0 z-10 bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto max-w-5xl px-5 h-11 flex items-center gap-5">
        <Link href="/" className="text-ink hover:text-accent shrink-0">
          <span className="text-accent">/</span>cg
        </Link>

        <nav className="flex items-center gap-4 text-muted text-[12px]">
          <Link href="/" className="hover:text-ink">
            tasks
          </Link>
          <Link href="/board" className="hover:text-ink">
            board
          </Link>
          {me ? (
            <Link href={`/u/${me.handle}`} className="hover:text-ink">
              profile
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          {rel ? (
            <span
              className="text-[11px] text-faint hidden sm:inline"
              title="Claims delivered inside the window"
            >
              reliability {rel.pct === null ? '—' : `${rel.pct}%`}
            </span>
          ) : null}
          <Link
            href="/tasks/new"
            className="text-[12px] px-2 py-0.5 border border-line-2 rounded-xs text-ink hover:border-faint"
          >
            + task
          </Link>
          {me ? <UserSwitch users={users} currentId={me.id} /> : null}
        </div>
      </div>
    </header>
  );
}
