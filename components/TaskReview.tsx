import { decideSubmissionAction } from '@/lib/actions';
import { diffAll } from '@/lib/diff';
import { one } from '@/lib/db';
import { parseDomains, submissionFiles, type FileRow, type SubmissionRow, type TaskCard } from '@/lib/queries';
import { START_RATING, nextRating } from '@/lib/rating';
import type { SessionUser } from '@/lib/session';
import { Button, Handle, Label, Panel, ago, inputCls } from './ui';
import { Diff } from './Diff';

/** What each verdict would do to the submitter's rating, shown before deciding. */
function preview(userId: number, domains: string[], difficulty: number) {
  return domains.map((domain) => {
    const row = one<{ rating: number; matches: number }>(
      'SELECT rating, matches FROM skills WHERE user_id = ? AND domain = ?',
      userId,
      domain,
    );
    const before = row?.rating ?? START_RATING;
    const matches = row?.matches ?? 0;
    return {
      domain,
      before: Math.round(before),
      accept: nextRating(before, matches, difficulty, true),
      reject: nextRating(before, matches, difficulty, false),
    };
  });
}

export function TaskReview({
  task,
  me,
  submissions,
  baseline,
}: {
  task: TaskCard;
  me: SessionUser | null;
  submissions: SubmissionRow[];
  baseline: FileRow[];
}) {
  if (submissions.length === 0) return null;
  const isRequester = me?.id === task.requester_id;
  const domains = parseDomains(task.domains);

  return (
    <section className="space-y-2">
      <Label>Submissions · {submissions.length}</Label>

      {submissions.map((s) => {
        const files = submissionFiles(s.id);
        const diffs = diffAll(baseline, files);
        const rows = preview(s.user_id, domains, task.difficulty);

        return (
          <Panel key={s.id}>
            <div className="flex items-baseline gap-2 px-3 py-2 border-b border-line flex-wrap">
              <Handle handle={s.handle} />
              <span className="text-[11px] text-faint">delivered {ago(s.created_at)}</span>
              <span
                className={`text-[10px] uppercase tracking-wider ${
                  s.status === 'accepted'
                    ? 'text-add'
                    : s.status === 'rejected'
                      ? 'text-del'
                      : 'text-warn'
                }`}
              >
                {s.status}
              </span>
              <span className="ml-auto text-[11px] tabular-nums text-faint">
                {diffs.length} file{diffs.length === 1 ? '' : 's'} changed
              </span>
            </div>

            {s.note ? (
              <p className="px-3 py-2 text-muted whitespace-pre-wrap leading-relaxed border-b border-line">
                {s.note}
              </p>
            ) : null}

            <Diff files={diffs} />

            {s.review ? (
              <p className="px-3 py-2 border-t border-line text-muted whitespace-pre-wrap">
                <span className="text-faint text-[11px]">review: </span>
                {s.review}
              </p>
            ) : null}

            {isRequester && s.status === 'pending' ? (
              <div className="border-t border-line p-3 space-y-2">
                <div className="text-[11px] text-faint space-y-0.5">
                  {rows.map((r) => (
                    <div key={r.domain} className="tabular-nums">
                      {r.domain}: {r.before} → <span className="text-add">{r.accept}</span> if
                      accepted, <span className="text-del">{r.reject}</span> if rejected
                    </div>
                  ))}
                </div>

                <form action={decideSubmissionAction} className="space-y-2">
                  <input type="hidden" name="submission_id" value={s.id} />
                  <textarea
                    name="review"
                    rows={2}
                    placeholder="Optional note back to the contributor."
                    className={`${inputCls} resize-y`}
                  />
                  <div className="flex items-center gap-2">
                    <Button type="submit" name="decision" value="accept" variant="good">
                      accept
                    </Button>
                    <Button type="submit" name="decision" value="reject" variant="bad">
                      reject &amp; reopen
                    </Button>
                  </div>
                </form>
              </div>
            ) : null}
          </Panel>
        );
      })}
    </section>
  );
}
