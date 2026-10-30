import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_RELIABILITY,
  levelOf,
  meetsReliability,
  nextRating,
  reliability,
} from '../lib/rating';
import { diffAll, fileDiff } from '../lib/diff';

/* The rating rules are the part of this app that is easy to get subtly wrong
   and impossible to eyeball, so they are the part with tests.
   Run: npm test                                                            */

test('levels sit on the documented boundaries', () => {
  assert.equal(levelOf(1249), 1);
  assert.equal(levelOf(1250), 2);
  assert.equal(levelOf(1449), 2);
  assert.equal(levelOf(1450), 3);
  assert.equal(levelOf(1649), 3);
  assert.equal(levelOf(1650), 4);
});

test('acceptance raises a rating, rejection lowers it', () => {
  assert.ok(nextRating(1200, 0, 2, true) > 1200);
  assert.ok(nextRating(1200, 0, 2, false) < 1200);
});

test('a harder task is worth more than an easy one', () => {
  const easy = nextRating(1200, 0, 1, true) - 1200;
  const hard = nextRating(1200, 0, 4, true) - 1200;
  assert.ok(hard > easy, `expected d4 gain ${hard} > d1 gain ${easy}`);
});

test('provisional accounts move faster than settled ones', () => {
  const provisional = nextRating(1200, 0, 2, true) - 1200;
  const settled = nextRating(1200, 40, 2, true) - 1200;
  assert.ok(provisional > settled);
});

test('grinding trivial tasks cannot unlock a hard gate', () => {
  let r = 1200;
  for (let i = 0; i < 200; i++) r = nextRating(r, i, 1, true);
  assert.equal(levelOf(r), 2, `200 accepted trivial tasks reached ${r}`);
});

test('moderate tasks top out at L3, hard tasks are uncapped', () => {
  let mid = 1200;
  for (let i = 0; i < 200; i++) mid = nextRating(mid, i, 2, true);
  assert.equal(levelOf(mid), 3);

  let hard = 1200;
  for (let i = 0; i < 200; i++) hard = nextRating(hard, i, 4, true);
  assert.equal(levelOf(hard), 4);
});

test('a cap never drags an existing rating down', () => {
  const strong = 1700;
  assert.ok(nextRating(strong, 30, 1, true) >= strong);
});

test('ratings have a floor so a bad run is recoverable', () => {
  let r = 1200;
  for (let i = 0; i < 300; i++) r = nextRating(r, i, 4, false);
  assert.ok(r >= 800, `floor breached: ${r}`);
});

test('reliability is unknown until a claim has been taken', () => {
  assert.equal(reliability(0, 0).pct, null);
  assert.ok(meetsReliability(reliability(0, 0)), 'newcomers must not be blocked');
  assert.equal(reliability(1, 3).pct, 33);
  assert.equal(meetsReliability(reliability(1, 3)), false);
  assert.ok(meetsReliability(reliability(1, 2)), `${MIN_RELIABILITY}% is a pass`);
});

test('diff counts only the lines that changed', () => {
  const d = fileDiff('a.txt', 'one\ntwo\nthree\n', 'one\nTWO\nthree\n');
  assert.equal(d.added, 1);
  assert.equal(d.removed, 1);
  assert.equal(d.status, 'modified');
});

test('a file with no baseline reads as new', () => {
  const d = fileDiff('new.ts', null, 'hello\n');
  assert.equal(d.status, 'added');
  assert.equal(d.removed, 0);
});

test('long untouched stretches collapse into one gap row', () => {
  const before = Array.from({ length: 60 }, (_, i) => `line ${i}`).join('\n');
  const after = before.replace('line 30', 'line thirty');
  const d = fileDiff('big.txt', before, after);
  assert.equal(d.rows.filter((r) => r.kind === 'gap').length, 2);
  assert.ok(d.rows.length < 20, `expected a collapsed view, got ${d.rows.length} rows`);
});

test('untouched files are dropped from a submission diff', () => {
  const base = [
    { path: 'a.ts', content: 'same\n' },
    { path: 'b.ts', content: 'old\n' },
  ];
  const next = [
    { path: 'a.ts', content: 'same\n' },
    { path: 'b.ts', content: 'new\n' },
    { path: 'c.ts', content: 'added\n' },
  ];
  const out = diffAll(base, next);
  assert.deepEqual(
    out.map((d) => d.path),
    ['b.ts', 'c.ts'],
  );
});
