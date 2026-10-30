import Link from 'next/link';
import { createTask } from '@/lib/actions';
import { fetchTree, parseRepoUrl } from '@/lib/github';
import { DIFFICULTY_LABEL } from '@/lib/rating';
import { FileFields } from '@/components/FileFields';
import { Button, Field, Label, Panel, inputCls } from '@/components/ui';

export default async function NewTask({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; repo?: string; e?: string }>;
}) {
  const sp = await searchParams;
  const mode = sp.mode === 'repo' || sp.repo ? 'repo' : 'files';
  const error = sp.e;

  /* Repo mode is two steps: paste a URL (a plain GET back to this page), then
     tick the files that are in scope. No OAuth, no client-side fetching. */
  const ref = sp.repo ? parseRepoUrl(sp.repo) : null;
  const tree = ref ? await fetchTree(ref) : null;

  return (
    <div className="max-w-3xl space-y-5">
      <div>
        <h1 className="text-ink text-[15px]">Post a task</h1>
        <p className="text-faint text-[12px] mt-0.5">
          Describe the change you want and put the relevant files in scope.
        </p>
      </div>

      {error ? (
        <div className="border border-del/40 bg-del/10 text-del rounded-xs px-3 py-2 text-[12px]">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-px text-[12px]">
        {(
          [
            ['files', 'paste files'],
            ['repo', 'import from a public repo'],
          ] as const
        ).map(([m, text]) => (
          <Link
            key={m}
            href={`/tasks/new?mode=${m}`}
            className={`px-2.5 py-1 border rounded-xs ${
              mode === m
                ? 'border-line-2 text-ink bg-panel-2'
                : 'border-transparent text-faint hover:text-muted'
            }`}
          >
            {text}
          </Link>
        ))}
      </div>

      {mode === 'repo' ? (
        <Panel className="p-3">
          <form method="GET" action="/tasks/new" className="flex items-end gap-2">
            <input type="hidden" name="mode" value="repo" />
            <div className="flex-1">
              <Field label="Public repo URL" hint="read-only, no sign-in">
                <input
                  name="repo"
                  defaultValue={sp.repo ?? ''}
                  placeholder="https://github.com/owner/repo"
                  className={inputCls}
                />
              </Field>
            </div>
            <Button type="submit">load files</Button>
          </form>

          {sp.repo && !ref ? (
            <p className="text-del text-[12px] mt-2">
              That does not look like a public GitHub repo URL.
            </p>
          ) : null}
          {tree && !tree.ok ? (
            <p className="text-del text-[12px] mt-2">{tree.error}</p>
          ) : null}
        </Panel>
      ) : null}

      <form action={createTask} className="space-y-4">
        <input type="hidden" name="source_kind" value={mode} />
        {mode === 'repo' && ref && tree?.ok ? (
          <>
            <input type="hidden" name="repo_url" value={sp.repo} />
            <input type="hidden" name="ref" value={tree.ref} />
          </>
        ) : null}

        <Panel className="p-3 space-y-4">
          <Field label="Title">
            <input
              name="title"
              placeholder="Fix mobile nav overflow below 380px"
              className={inputCls}
              required
            />
          </Field>

          <Field label="What needs to change" hint="acceptance criteria help a lot">
            <textarea
              name="body"
              rows={5}
              placeholder={'The nav wraps onto a second line on small screens.\n\nDone when: single row down to 320px, no horizontal scroll, existing links unchanged.'}
              className={`${inputCls} resize-y leading-relaxed`}
            />
          </Field>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Domains" hint="comma separated">
              <input name="domains" placeholder="css, react" className={inputCls} required />
            </Field>

            <Field label="Difficulty">
              <select name="difficulty" defaultValue="2" className={inputCls}>
                {[1, 2, 3, 4].map((d) => (
                  <option key={d} value={d}>
                    {d} · {DIFFICULTY_LABEL[d]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Claim gate">
              <select name="min_level" defaultValue="1" className={inputCls}>
                {[1, 2, 3, 4].map((l) => (
                  <option key={l} value={l}>
                    L{l}+ to claim
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <p className="text-[11px] text-faint leading-relaxed border-t border-line pt-3">
            The gate only limits who may <em>claim</em>. Anyone can still send you a proposal —
            below-gate pitches are flagged and sorted last, and you can wave someone in by hand.
            A high gate on a young board means fewer people can pick it up, so set it to the
            level the work actually needs.
          </p>
        </Panel>

        {mode === 'repo' ? (
          tree?.ok ? (
            <Panel className="p-3 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Files in scope</Label>
                <span className="text-[11px] text-faint">
                  {ref!.owner}/{ref!.repo}@{tree.ref} · {tree.entries.length} text files
                  {tree.truncated ? ' (truncated)' : ''}
                </span>
              </div>
              <div className="max-h-72 overflow-y-auto border border-line rounded-xs divide-y divide-line">
                {tree.entries.map((f) => (
                  <label
                    key={f.path}
                    className="flex items-center gap-2 px-2 py-1 hover:bg-panel-2 cursor-pointer"
                  >
                    <input type="checkbox" name="paths" value={f.path} className="accent-accent" />
                    <span className="text-[12px] text-ink truncate">{f.path}</span>
                    <span className="ml-auto text-[11px] text-faint tabular-nums shrink-0">
                      {(f.size / 1024).toFixed(1)}k
                    </span>
                  </label>
                ))}
              </div>
              <p className="text-[11px] text-faint">
                Up to 25 files are pulled at their current contents and become the baseline every
                diff is measured against.
              </p>
            </Panel>
          ) : null
        ) : (
          <Panel className="p-3">
            <FileFields hint="the current contents — contributors edit copies of these" />
          </Panel>
        )}

        {mode === 'files' || tree?.ok ? (
          <div className="flex items-center gap-3">
            <Button type="submit" variant="primary">
              post task
            </Button>
            <Link href="/" className="text-faint text-[12px] hover:text-muted">
              cancel
            </Link>
          </div>
        ) : null}
      </form>
    </div>
  );
}
