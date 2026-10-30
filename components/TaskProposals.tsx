import { pickProposalAction, proposeAction } from '@/lib/actions';
import { gateFor } from '@/lib/gate';
import type { ProposalRow, TaskCard } from '@/lib/queries';
import type { SessionUser } from '@/lib/session';
import { Button, Empty, Handle, Label, LevelTag, Panel, ago, inputCls } from './ui';

/* Proposals: the cheap round that exists so nobody writes code speculatively.
   Below-gate pitches are shown, flagged, and sorted last — never hidden. */
export function TaskProposals({
  task,
  me,
  proposals,
}: {
  task: TaskCard;
  me: SessionUser | null;
  proposals: ProposalRow[];
}) {
  const isRequester = me?.id === task.requester_id;
  const mine = proposals.find((p) => p.user_id === me?.id);
  const canPropose = me && !isRequester && task.status === 'open';

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between">
        <Label>Proposals · {proposals.length}</Label>
        {task.status !== 'open' ? (
          <span className="text-[11px] text-faint">closed — task is {task.status}</span>
        ) : null}
      </div>

      <Panel>
        {proposals.length === 0 ? (
          <Empty>No proposals yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {proposals.map((p) => {
              const gate = gateFor(p.user_id, task);
              return (
                <li key={p.id} className="px-3 py-2.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <Handle handle={p.handle} />
                    <span className="text-[11px] text-faint">
                      <LevelTag level={gate.level} /> in {task.domains} ·{' '}
                      {Math.round(gate.rating)}
                      {gate.reliability.pct !== null
                        ? ` · ${gate.reliability.pct}% reliable`
                        : ' · no track record'}
                    </span>

                    {p.below_gate ? (
                      <span
                        className="text-[10px] uppercase tracking-wider text-warn border border-warn/40 rounded-xs px-1"
                        title={gate.reasons.join('; ')}
                      >
                        below gate
                      </span>
                    ) : null}
                    {p.status === 'picked' ? (
                      <span className="text-[10px] uppercase tracking-wider text-add">picked</span>
                    ) : null}
                    {p.status === 'forfeited' ? (
                      <span className="text-[10px] uppercase tracking-wider text-del">
                        forfeited
                      </span>
                    ) : null}
                    <span className="ml-auto text-[11px] text-faint">{ago(p.created_at)}</span>
                  </div>

                  <p className="mt-1.5 text-muted whitespace-pre-wrap leading-relaxed">{p.body}</p>

                  {isRequester && task.status === 'open' ? (
                    <form action={pickProposalAction} className="mt-2 flex items-center gap-2">
                      <input type="hidden" name="proposal_id" value={p.id} />
                      {gate.ok ? null : <input type="hidden" name="override" value="1" />}
                      <Button type="submit" variant={gate.ok ? 'primary' : 'default'}>
                        {gate.ok ? 'pick — starts the 48h claim' : 'wave in anyway'}
                      </Button>
                      {gate.ok ? null : (
                        <span className="text-[11px] text-faint">{gate.reasons.join('; ')}</span>
                      )}
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      {canPropose ? (
        <Panel className="p-3">
          <form action={proposeAction} className="space-y-2">
            <input type="hidden" name="task_id" value={task.id} />
            <Label>{mine ? 'Update your proposal' : 'Propose an approach'}</Label>
            <textarea
              name="body"
              rows={3}
              defaultValue={mine?.body ?? ''}
              placeholder="Two or three lines on how you'd do it. Enough for the requester to choose between approaches."
              className={`${inputCls} resize-y leading-relaxed`}
            />
            <div className="flex items-center gap-3">
              <Button type="submit">{mine ? 'update' : 'send proposal'}</Button>
              <span className="text-[11px] text-faint">
                Costs you nothing if you are not picked — that is the point.
              </span>
            </div>
          </form>
        </Panel>
      ) : null}
    </section>
  );
}
