import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ancestors, sameStart, startTimes } from '../src/sources/processInfo';

test('sameStart: equal within a second, otherwise different', () => {
  assert.equal(sameStart('134372554846231260', '134372554846231266'), true, '600 ns apart (CIM vs Claude rounding)');
  assert.equal(sameStart('134372554846231266', '134372554856231266'), true, 'exactly 1 s apart');
  assert.equal(sameStart('134372554846231266', '134372554866231266'), false, '2 s apart: a different process');
  assert.equal(sameStart('not-a-number', '134372554846231266'), false);
});

test('startTimes: this process started moments ago (Windows), nothing elsewhere', async () => {
  const times = await startTimes([process.pid]);
  if (process.platform !== 'win32') {
    assert.equal(times.size, 0);
    return;
  }
  const ft = BigInt(times.get(process.pid)!);
  const started = Number(ft / 10_000n - 11_644_473_600_000n); // FILETIME -> epoch ms
  const age = Date.now() - started;
  assert.ok(age >= 0 && age < 120_000, `started ${age} ms ago`);
});

test('ancestors: the parent chain starts with our parent', async () => {
  const chain = await ancestors(process.pid, 3);
  assert.equal(chain[0], process.ppid);
});
