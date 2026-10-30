"""End-to-end check of the task loop, driven the way a browser drives it:
multipart POSTs carrying the form's $ACTION_ID field, cookies kept in a jar.

Nothing here reaches into the app to change state — every transition goes
through a real server action. SQLite is read (never written) only to look up
ids, because the page markup does not expose them.

Run:  npm run dev      # in another terminal
      npm run seed
      python scripts/smoke.py
"""

import os
import re
import sqlite3
import subprocess
import sys
import tempfile

BASE = 'http://localhost:3000'
JAR = os.path.join(tempfile.gettempdir(), 'cg-jar.txt')
DB = os.path.join(os.getcwd(), 'data', 'app.db')

MAYA, ISHITA = 'maya', 'ishita'


def curl(path, fields=None):
    cmd = ['curl', '-s', '-c', JAR, '-b', JAR, '-L', BASE + path]
    if fields:
        cmd += ['-X', 'POST']
        for k, v in fields:
            cmd += ['-F', f'{k}={v}']
    out = subprocess.run(cmd, capture_output=True, text=True, encoding='utf-8')
    return out.stdout or ''


def q1(sql, *params):
    """One scalar out of the app's database — for ids and assertions only."""
    con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
    try:
        row = con.execute(sql, params).fetchone()
    finally:
        con.close()
    return row[0] if row else None


def text(html):
    """React separates adjacent text nodes with <!-- -->, which breaks naive
    phrase matching. Strip the markers before looking for copy."""
    return re.sub(r'<!--.*?-->', '', html)


def forms(html):
    """Every server-action form as (action_id, [field names], raw markup)."""
    out = []
    for f in re.findall(r'<form\b.*?</form>', html, re.S):
        m = re.search(r'name="(\$ACTION_ID_[a-f0-9]+)"', f)
        if m:
            names = [n for n in re.findall(r'name="([^"]+)"', f) if not n.startswith('$')]
            out.append((m.group(1), names, f))
    return out


def find_form(html, *required):
    """First form whose fields cover everything in `required`."""
    for aid, names, raw in forms(html):
        if all(r in names for r in required):
            return aid, raw
    return None, None


def hidden(raw, name):
    m = re.search(rf'name="{re.escape(name)}"[^>]*value="([^"]*)"', raw)
    if m:
        return m.group(1)
    m = re.search(rf'value="([^"]*)"[^>]*name="{re.escape(name)}"', raw)
    return m.group(1) if m else None


def switch(handle):
    """Take a different seat. The cookie is the whole of the session in v1."""
    uid = q1('SELECT id FROM users WHERE handle = ?', handle)
    aid, _ = find_form(curl('/'), 'userId')
    assert aid, 'no user-switch form in the header'
    curl('/', [(aid, ''), ('userId', str(uid))])
    return uid


def check(label, ok, detail=''):
    print(f'{"PASS" if ok else "FAIL"}  {label}{"  " + detail if detail else ""}')
    if not ok:
        sys.exit(1)


def rating(handle, domain):
    return q1(
        'SELECT rating FROM skills WHERE user_id = (SELECT id FROM users WHERE handle = ?) AND domain = ?',
        handle, domain)


TASK = 1
if os.path.exists(JAR):
    os.remove(JAR)

requester = q1(
    'SELECT handle FROM users WHERE id = (SELECT requester_id FROM tasks WHERE id = ?)', TASK)
check('the fixture is the freshly seeded open task',
      q1('SELECT status FROM tasks WHERE id = ?', TASK) == 'open', f'requester @{requester}')

# ── propose ──────────────────────────────────────────────────────────────
switch(MAYA)
aid, _ = find_form(curl(f'/tasks/{TASK}'), 'task_id', 'body')
check('a non-requester is offered the proposal form', bool(aid))
PITCH = 'flex-wrap: nowrap on the outer nav, overflow-x on the link list, drop the fixed ml-8.'
curl(f'/tasks/{TASK}', [(aid, ''), ('task_id', str(TASK)), ('body', PITCH)])
check('the proposal is stored and rendered', PITCH[:40] in curl(f'/tasks/{TASK}'))

# ── pick, which opens the exclusive 48h window ───────────────────────────
switch(requester)
html = curl(f'/tasks/{TASK}')
pid = str(q1(
    'SELECT p.id FROM proposals p JOIN users u ON u.id = p.user_id'
    ' WHERE p.task_id = ? AND u.handle = ?', TASK, MAYA))
aid = raw = None
for a, _names, r in forms(html):
    if hidden(r, 'proposal_id') == pid:
        aid, raw = a, r
check('the requester sees a pick control on that proposal', bool(aid), f'proposal {pid}')
fields = [(aid, ''), ('proposal_id', pid)]
if 'name="override"' in raw:
    fields.append(('override', '1'))
curl(f'/tasks/{TASK}', fields)
page = text(curl(f'/tasks/{TASK}'))
check('the task moves to claimed', f'claimed by @{MAYA}' in page)
check('the claim shows a countdown', re.search(r'\d+h of 48 left', page) is not None)
check('exactly one proposal is picked and the rest are closed',
      q1('SELECT COUNT(*) FROM proposals WHERE task_id = ? AND status = ?', TASK, 'picked') == 1)

# ── the claimer, and only the claimer, gets the editor ────────────────────
switch(MAYA)
check('the claimer reaches the editor', 'Your claim' in curl(f'/tasks/{TASK}/work'))
switch(ISHITA)
check('everyone else is redirected away', 'Your claim' not in curl(f'/tasks/{TASK}/work'))

# ── deliver ──────────────────────────────────────────────────────────────
kept_before = q1('SELECT claims_kept FROM users WHERE handle = ?', MAYA)
switch(MAYA)
aid, _ = find_form(curl(f'/tasks/{TASK}/work'), 'task_id', 'note', 'file_path', 'file_content')
check('the submit form is present', bool(aid))
NEW = '\n'.join([
    'export function Nav({ links }) {',
    '  return (',
    '    <nav className="flex flex-nowrap items-center gap-4 px-4 py-4">',
    '      <a href="/" className="text-lg font-semibold shrink-0">Shop</a>',
    '      <div className="flex gap-4 overflow-x-auto">',
    '        {links.map((l) => (',
    '          <a key={l.href} href={l.href} className="whitespace-nowrap">',
    '            {l.label}',
    '          </a>',
    '        ))}',
    '      </div>',
    '      <button className="ml-auto shrink-0 px-3 py-2 border">Cart</button>',
    '    </nav>',
    '  );',
    '}',
    '',
])
curl(f'/tasks/{TASK}', [
    (aid, ''),
    ('task_id', str(TASK)),
    ('note', 'Single row down to 320px; the link list scrolls instead of wrapping.'),
    ('file_path', 'components/Nav.tsx'),
    ('file_content', NEW),
])
check('the task moves to review', q1('SELECT status FROM tasks WHERE id = ?', TASK) == 'review')
check('the diff shows the changed line', 'flex-nowrap' in curl(f'/tasks/{TASK}'))
check('delivering is what counts towards reliability',
      q1('SELECT claims_kept FROM users WHERE handle = ?', MAYA) == kept_before + 1)

# ── accept ───────────────────────────────────────────────────────────────
# Task 1 is difficulty 2 in css,react. Maya is 1655 in css — already above the
# ceiling a moderate task can lift anyone to — and 1520 in react. So the accept
# is expected to raise react and leave css exactly where it is: the anti-farming
# cap, observed through the real HTTP path rather than in a unit test.
css_before, react_before = rating(MAYA, 'css'), rating(MAYA, 'react')
switch(requester)
aid, raw = find_form(curl(f'/tasks/{TASK}'), 'submission_id', 'review')
check('the requester sees the verdict controls', bool(aid))
curl(f'/tasks/{TASK}', [
    (aid, ''),
    ('submission_id', hidden(raw, 'submission_id')),
    ('review', 'Holds at 320px with no horizontal scroll. Good.'),
    ('decision', 'accept'),
])
check('the task is done', q1('SELECT status FROM tasks WHERE id = ?', TASK) == 'done')
check('the submission is accepted',
      q1('SELECT status FROM submissions WHERE task_id = ? ORDER BY id DESC LIMIT 1', TASK) == 'accepted')
css_after, react_after = rating(MAYA, 'css'), rating(MAYA, 'react')
check('the rating rises in the domain that is below the cap', react_after > react_before,
      f'react {round(react_before)} -> {round(react_after)}')
check('a moderate task cannot push a rating past its tier ceiling', css_after == css_before,
      f'css held at {round(css_after)}')
check('the cap never drags an existing rating down', css_after >= css_before)
check('one audit row per task domain',
      q1('SELECT COUNT(*) FROM rating_events WHERE task_id = ?'
         ' AND user_id = (SELECT id FROM users WHERE handle = ?)', TASK, MAYA) == 2)
check('the profile shows the history entry', 'Fix mobile nav overflow' in curl(f'/u/{MAYA}'))

print('\nfull loop verified: propose -> pick -> deliver -> accept -> rating moves')
