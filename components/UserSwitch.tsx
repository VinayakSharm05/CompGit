'use client';

import { useRef } from 'react';
import { switchUser } from '@/lib/actions';

/* v1 has no login screen. This is the seat-swap control that makes the whole
   loop testable in one browser: post a task as one person, propose as
   another, review as the first. Replaced wholesale when real auth lands. */
export function UserSwitch({
  users,
  currentId,
}: {
  users: { id: number; name: string; handle: string }[];
  currentId: number;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action={switchUser} className="flex items-center gap-1.5">
      <span className="text-faint text-[11px]">acting as</span>
      <select
        name="userId"
        defaultValue={currentId}
        onChange={() => form.current?.requestSubmit()}
        aria-label="Switch account"
        className="bg-canvas border border-line rounded-xs px-1.5 py-0.5 text-[12px] cursor-pointer hover:border-line-2 outline-none"
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </form>
  );
}
