import Link from 'next/link';

/* Shared visual primitives. Flat surfaces, 1px lines, monospace, at most a
   2px radius — the look should read as a developer tool, not a dashboard. */

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.14em] text-faint select-none">
      {children}
    </div>
  );
}

export function Panel({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-line bg-panel rounded-xs ${className}`}>{children}</div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <Label>{label}</Label>
        {hint ? <span className="text-[11px] text-faint">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

export const inputCls =
  'w-full bg-canvas border border-line rounded-xs px-2.5 py-1.5 text-ink ' +
  'placeholder:text-faint focus:border-line-2 outline-none';

export function Button({
  children,
  variant = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'good' | 'bad' | 'ghost';
}) {
  const base =
    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xs border text-[12px] ' +
    'transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer';
  const styles = {
    default: 'border-line-2 bg-panel-2 text-ink hover:border-faint',
    primary: 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20',
    good: 'border-add/40 bg-add/10 text-add hover:bg-add/20',
    bad: 'border-del/40 bg-del/10 text-del hover:bg-del/20',
    ghost: 'border-transparent text-muted hover:text-ink',
  }[variant];
  return (
    <button className={`${base} ${styles}`} {...rest}>
      {children}
    </button>
  );
}

const LEVEL_COLOR = ['', 'text-faint', 'text-accent', 'text-add', 'text-warn'];

export function LevelTag({ level, prefix = 'L' }: { level: number; prefix?: string }) {
  const n = Math.min(4, Math.max(1, level));
  return (
    <span className={`${LEVEL_COLOR[n]} tabular-nums`}>
      {prefix}
      {n}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-1.5 py-px border border-line rounded-xs text-[11px] text-muted">
      {children}
    </span>
  );
}

const STATUS = {
  open: { color: 'text-add', dot: 'bg-add', text: 'open' },
  claimed: { color: 'text-warn', dot: 'bg-warn', text: 'claimed' },
  review: { color: 'text-accent', dot: 'bg-accent', text: 'in review' },
  done: { color: 'text-faint', dot: 'bg-faint', text: 'done' },
} as const;

export function Status({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status] ?? STATUS.open;
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-3 py-6 text-center text-faint text-[12px]">{children}</div>;
}

export function Handle({ handle }: { handle: string }) {
  return (
    <Link href={`/u/${handle}`} className="text-muted hover:text-accent">
      @{handle}
    </Link>
  );
}

/** Coarse relative time. Timestamps are UTC strings from SQLite. */
export function ago(iso: string): string {
  const then = Date.parse(iso.replace(' ', 'T') + 'Z');
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Hours left on a claim, floored at zero. */
export function hoursLeft(iso: string | null): number {
  if (!iso) return 0;
  const end = Date.parse(iso.replace(' ', 'T') + 'Z');
  return Math.max(0, Math.round((end - Date.now()) / 3600000));
}
