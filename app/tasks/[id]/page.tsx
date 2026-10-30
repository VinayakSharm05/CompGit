import Link from 'next/link';
import { notFound } from 'next/navigation';
import { releaseClaimAction } from '@/lib/actions';
import { eligibleCount, gateFor } from '@/lib/gate';
import {
  getTask,
  parseDomains,
  taskFiles,
  taskProposals,
  taskSubmissions,
} from '@/lib/queries';
import { CLAIM_HOURS, DIFFICULTY_LABEL } from '@/lib/rating';
import { currentUser } from '@/lib/session';
import { TaskProposals } from '@/components/TaskProposals';
import { TaskReview } from '@/components/TaskReview';
import {
  Button,
  Handle,
  Label,
  LevelTag,
  Panel,
  Status,
  Tag,
  ago,
  hoursLeft,
} from '@/components/ui';

export default async function TaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string }>;
}) {
  const { id } = await params;
  const { e: error } = await searchParams;
  const task = getTask(Number(id));
  if (!task) notFound();

  const me = await currentUser();
  const files = taskFiles(task.id);
  const proposals = taskProposals(task.id);
  const submissions = taskSubmissions(task.id);
  const gate = me ? gateFor(me.id, task) : null;
  const eligible = eligibleCount(task);
  const isRequester = me?.id === task.requester_id;
  const isClaimer = me?.id === task.claimed_by;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link href="/" className="text-faint text-[11px] hover:text-muted">
          ← tasks
        </Link>
        <div className="flex items-baseline gap-3 flex-wrap">
          <span className="text-faint tabular-nums">#{task.id}</span>
          <h1 className="text-ink text-[15px] flex-1 min-w-0">{task.title}</h1>
          <span className="text-[11px]">
            <Status status={task.status} />
          </span>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-faint">
          {parseDomains(task.domains).map((d) => (
            <Tag key={d}>{d}</Tag>
          ))}
          <span>{DIFFICULTY_LABEL[task.difficulty]}</span>
          <span>
            gate <LevelTag level={task.min_level} />+
          </span>
          <span title="People who currently clear this gate">
            {eligible} eligible
            {eligible <= 2 ? (
              <span className="text-warn"> · thin pool, expect a slow response</span>
            ) : null}
          </span>
          <span className="ml-auto">
            <Handle handle={task.requester_handle} /> · {ago(task.created_at)}
          </span>
        </div>
      </div>

      {error ? (
        <div className="border border-del/40 bg-del/10 text-del rounded-xs px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      {task.body ? (
        <Panel className="p-3">
          <p className="text-muted whitespace-pre-wrap leading-relaxed">{task.body}</p>
        </Panel>
      ) : null}

      {/* Claim state — the one place that says what happens next and to whom. */}
      {task.status === 'claimed' ? (
        <Panel className="p-3 flex items-center gap-3 flex-wrap">
          <span className="text-warn">
            claimed by @{task.claimer_handle} · {hoursLeft(task.claim_expires_at)}h of{' '}
            {CLAIM_HOURS} left
          </span>
          {isClaimer ? (
            <div className="ml-auto flex items-center gap-2">
              <Link href={`/tasks/${task.id}/work`}>
                <Button variant="primary">open the editor</Button>
              </Link>
              <form action={releaseClaimAction}>
                <input type="hidden" name="task_id" value={task.id} />
                <Button variant="ghost" type="submit">
                  release claim
                </Button>
              </form>
            </div>
          ) : (
            <span className="ml-auto text-[11px] text-faint">
              Nobody else can submit while the window is open.
            </span>
          )}
        </Panel>
      ) : null}

      {task.status === 'open' && me && !isRequester ? (
        <Panel className="p-3 text-[12px]">
          {gate!.ok ? (
            <span className="text-add">
              You clear this gate — <LevelTag level={gate!.level} /> in {task.domains}, rating{' '}
              {Math.round(gate!.rating)}.
            </span>
          ) : (
            <span className="text-warn">
              Below the gate: {gate!.reasons.join('; ')}. You can still propose — the requester
              may wave you in.
            </span>
          )}
        </Panel>
      ) : null}

      <TaskReview task={task} me={me} submissions={submissions} baseline={files} />

      <TaskProposals task={task} me={me} proposals={proposals} />

      <details className="group">
        <summary className="cursor-pointer text-[11px] uppercase tracking-[0.14em] text-faint hover:text-muted select-none">
          Files in scope · {files.length}
          {task.source_kind === 'repo' && task.repo_url ? (
            <span className="normal-case tracking-normal"> · from {task.repo_url}</span>
          ) : null}
        </summary>
        <div className="mt-2 space-y-2">
          {files.map((f) => (
            <Panel key={f.id}>
              <div className="px-3 py-1.5 border-b border-line bg-panel-2 text-accent text-[12px]">
                {f.path}
              </div>
              <pre className="px-3 py-2 overflow-x-auto text-[12px] leading-[1.55] text-muted">
                {f.content}
              </pre>
            </Panel>
          ))}
        </div>
      </details>
    </div>
  );
}
