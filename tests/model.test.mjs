// Run with: node tests/model.test.mjs
import assert from 'node:assert/strict';
import { WORKOUTS } from '../js/workouts.js';
import { normalizeWorkout, positionAt, summarize } from '../js/model.js';
import { Player } from '../js/player.js';

const W = normalizeWorkout(WORKOUTS[0]);
const at = (t) => positionAt(W, t);

assert.equal(W.roundSeconds, 360);
assert.equal(W.strip.length, 6);
assert.deepEqual(W.strip.map((c) => c.kind), ['work', 'work', 'work', 'work', 'rest', 'rest']);

assert.equal(at(0).type, 'getready');
assert.equal(at(0).next.name, 'Halo, clockwise');
assert.equal(at(10).name, 'Halo, clockwise');
assert.equal(at(25).name, 'Halo, counterclockwise');
assert.equal(at(55).type, 'rest');
assert.equal(at(55).next.name, 'Swings');
assert.equal(at(70).name, 'Swings');
assert.equal(at(70).minute, 2);
assert.equal(at(70).set, 'Full Body');
assert.equal(at(250).type, 'longRest');
assert.equal(at(250).minute, 5);
assert.equal(at(369).minute, 6);
assert.equal(at(369).next.name, 'Halo, clockwise');
assert.equal(at(370).round, 2);
assert.equal(at(370).minute, 1);
assert.equal(at(370).name, 'Halo, clockwise');

// Brief / design example: three full rounds
const s = summarize(W, 10 + 3 * 360);
assert.equal(s.fullRounds, 3);
assert.equal(s.sets, 12);
assert.equal(s.workSeconds, 480);
assert.equal(s.stoppedIn, null);

const s2 = summarize(W, 10 + 360 + 35); // round 2, minute 1, mid-curls
assert.equal(s2.fullRounds, 1);
assert.equal(s2.sets, 4);
assert.equal(s2.workSeconds, 160 + 35);

// The flat "blocks array" shape from the brief works too
const flat = normalizeWorkout({
  name: 'Flat', getReadySeconds: 5, repeat: false,
  blocks: [{ set: 'A', segments: [{ name: 'Press', seconds: 30, type: 'work' }, { name: 'Rest', seconds: 30, type: 'rest' }] }],
});
assert.equal(positionAt(flat, 6).name, 'Press');
assert.equal(positionAt(flat, 65).done, true);
assert.throws(() => normalizeWorkout({ name: 'Bad', blocks: {}, sequence: ['nope'] }), /unknown block/);

// Player keeps time from the clock and excludes paused time
let now = 0;
const p = new Player(W, { speed: 10, now: () => now });
p.start();
now = 1000; assert.equal(p.elapsed(), 10);
p.pause(); now = 60000; assert.equal(p.elapsed(), 10);
p.resume(); now = 61000; assert.equal(p.elapsed(), 20);

console.log('model tests passed');
