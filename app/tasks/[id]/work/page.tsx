import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { submitWorkAction } from '@/lib/actions';
import { getTask, taskFiles } from '@/lib/queries';
import { CLAIM_HOURS } from '@/lib/rating';
import { currentUser } from '@/lib/session';
import { FileFields } from '@/components/FileFields';
import { Button, Label, Panel, hoursLeft, inputCls } from '@/components/ui';

export default async function WorkPage({
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
  // The exclusive window is the whole point: only the claimer works here.
  if (!me || task.claimed_by !== me.id || task.status !== 'claimed') {
    redirect(`/tasks/${task.id}`);
  }

  const files = taskFiles(task.id);
  const left = hoursLeft(task.claim_expires_at);

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link href={`/tasks/${task.id}`} className="text-faint text-[11px] hover:text-muted">
          ← #{task.id} {task.title}
        </Link>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-ink text-[15px]">Your claim</h1>
          <span className={`text-[12px] ${left <= 6 ? 'text-del' : 'text-warn'}`}>
            {left}h of {CLAIM_HOURS} left
          </span>
        </div>
        <p className="text-faint text-[12px]">
          Edit the files below. Only the lines you change show up in the diff the requester
          reviews.
        </p>
      </div>

      {error ? (
        <div className="border border-del/40 bg-del/10 text-del rounded-xs px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      {task.body ? (
        <Panel className="p-3">
          <Label>What was asked for</Label>
          <p className="mt-1 text-muted whitespace-pre-wrap leading-relaxed">{task.body}</p>
        </Panel>
      ) : null}

      <form action={submitWorkAction} className="space-y-4">
        <input type="hidden" name="task_id" value={task.id} />

        <Panel className="p-3">
          <FileFields
            initial={files.map((f) => ({ path: f.path, content: f.content }))}
            label="Your version"
            hint="add a file if the change needs one"
          />
        </Panel>

        <Panel className="p-3 space-y-2">
          <Label>Note to the requester</Label>
          <textarea
            name="note"
            rows={3}
            placeholder="What you changed and anything they should check."
            className={`${inputCls} resize-y leading-relaxed`}
          />
        </Panel>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary">
            submit for review
          </Button>
          <span className="text-[11px] text-faint">
            Delivering inside the window is what your reliability score counts — acceptance is
            what moves your rating.
          </span>
        </div>
      </form>
    </div>
  );
}
