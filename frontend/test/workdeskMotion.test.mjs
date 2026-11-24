import test from 'node:test';
import assert from 'node:assert/strict';
import { workloadTransition } from '../src/admin/components/overview/workloadTransition.js';

test('pulse columns wait for the entrance and finish in staggered order', () => {
  const motion = workloadTransition([], [.85, .4], true);
  assert.deepEqual(motion.sample(-1), [0, 0]);
  assert.deepEqual(motion.sample(350), [0, 0]);
  assert.ok(motion.sample(400)[0] > 0);
  assert.equal(motion.sample(400)[1], 0);
  assert.equal(motion.sample(1450)[0], .85);
  assert.ok(motion.sample(1450)[1] < .4);
  assert.equal(motion.end, 1510);
  assert.deepEqual(motion.sample(1510), [.85, .4]);
});

test('filter updates interpolate from the rendered values and accommodate new and removed dates', () => {
  const update = workloadTransition([.25, .75], [.75, 0, .5], false);
  assert.deepEqual(update.sample(0), [.25, .75, 0]);
  assert.equal(update.sample(400)[0], .5);
  assert.deepEqual(update.sample(update.end + 100), [.75, 0, .5]);
  const midway = update.sample(400);
  const second = workloadTransition(midway, [.1], false);
  assert.deepEqual(second.sample(0), [midway[0]]);
  assert.ok(second.sample(300)[0] > .1);
  assert.ok(Math.abs(second.sample(second.end)[0] - .1) < 1e-10);
});
