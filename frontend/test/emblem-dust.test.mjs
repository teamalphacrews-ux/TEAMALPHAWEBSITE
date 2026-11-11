import test from 'node:test';
import assert from 'node:assert/strict';
import { EMBLEM_DUST, createEmblemNoise, emblemDissolve, emblemFragmentByte, emblemReleaseScore, emblemSamplingProfile, sampleEmblemDust, selectEmblemStars } from '../src/saas/emblemDustModel.js';

function fixture(size = 64) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const arm = Math.round(size * .14);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (Math.abs(x - y) > arm && Math.abs((size - 1 - x) - y) > arm) continue;
    pixels.set([x * 3, y * 3, 190, 255], (y * size + x) * 4);
  }
  return pixels;
}

test('random breakup completes in the authored phase without removing the arrival', () => {
  assert.equal(emblemDissolve(0), 0);
  assert.equal(emblemDissolve(EMBLEM_DUST.start), 0);
  assert.equal(emblemDissolve(EMBLEM_DUST.end), 1);
  assert.equal(emblemDissolve(1), 1);
  assert.ok(emblemDissolve(.34) > .49 && emblemDissolve(.34) < .51);
});

test('sampled dust belongs to opaque source pixels and retains their colour', () => {
  const rgba = fixture();
  const sample = sampleEmblemDust(rgba, 64, 64, 1800);
  assert.equal(sample.count, 1800);
  for (let i = 0; i < sample.count; i++) {
    const point = sample.attributes.subarray(i * 9, i * 9 + 9);
    const x = Math.floor((point[0] + 1) * .5 * 64), y = Math.floor((1 - point[1]) * .5 * 64);
    const offset = (y * 64 + x) * 4;
    assert.equal(rgba[offset + 3], 255);
    assert.ok(Math.abs(point[3] - rgba[offset] / 255) < .00001);
    assert.ok(Math.abs(point[4] - rgba[offset + 1] / 255) < .00001);
    assert.ok(point.every(Number.isFinite));
    assert.ok(point[2] >= 0 && point[2] <= 1);
  }
});

test('fragment breakup covers every arm without a centre-to-tip release bias', () => {
  const profile = emblemSamplingProfile(true);
  const { attributes, count } = sampleEmblemDust(fixture(profile.size), profile.size, profile.size, profile.particles);
  const groups = Array.from({ length: 6 }, () => []);
  for (let i = 0; i < count; i++) {
    const [x, y, score] = attributes.subarray(i * 9, i * 9 + 3);
    groups[(x >= 0 ? 1 : 0) + (y >= 0 ? 2 : 0)].push(score);
    const radius = Math.hypot(x, y);
    if (radius < .4) groups[4].push(score);
    if (radius > .95) groups[5].push(score);
  }
  for (const scores of groups) {
    assert.ok(scores.length > 400);
    assert.ok(scores.filter(score => score < .25).length / scores.length > .15);
    assert.ok(scores.filter(score => score > .75).length / scores.length > .15);
    assert.ok(Math.abs(scores.reduce((sum, score) => sum + score, 0) / scores.length - .5) < .08);
  }
});

test('a compact particle prefix remains deterministic and distributed across all arms', () => {
  const sample = sampleEmblemDust(fixture(), 64, 64);
  const repeat = sampleEmblemDust(fixture(), 64, 64);
  assert.deepEqual(sample.attributes, repeat.attributes);
  const quadrants = new Set();
  for (let i = 0; i < Math.min(sample.count, EMBLEM_DUST.compactParticles); i++) {
    const x = sample.attributes[i * 9], y = sample.attributes[i * 9 + 1];
    quadrants.add((x >= 0 ? 1 : 0) + (y >= 0 ? 2 : 0));
  }
  assert.equal(quadrants.size, 4);
});

test('sparse stars are capped, stable, distinct subsets of real particles across all arms', () => {
  const sample = sampleEmblemDust(fixture(), 64, 64, 1800);
  const original = new Map();
  for (let i = 0; i < sample.count; i++) {
    const row = sample.attributes.subarray(i * 9, i * 9 + 9);
    original.set(`${row[0]},${row[1]}`, row);
  }
  for (const compact of [false, true]) {
    const stars = selectEmblemStars(sample, compact);
    assert.equal(stars.count, compact ? 32 : 96);
    assert.equal(stars.attributes.length, stars.count * 9);
    assert.deepEqual(stars, selectEmblemStars(sample, compact));
    const origins = new Set(), quadrants = new Set();
    for (let i = 0; i < stars.count; i++) {
      const row = stars.attributes.subarray(i * 9, i * 9 + 9), key = `${row[0]},${row[1]}`;
      assert.deepEqual(row, original.get(key));
      origins.add(key);
      quadrants.add((row[0] >= 0 ? 1 : 0) + (row[1] >= 0 ? 2 : 0));
    }
    assert.equal(origins.size, stars.count);
    assert.equal(quadrants.size, 4);
    const sparse = sampleEmblemDust(fixture(), 64, 64, 11);
    assert.deepEqual(selectEmblemStars(sparse, compact), sparse);
    const empty = selectEmblemStars({ attributes: new Float32Array(), count: 0 }, compact);
    assert.equal(empty.count, 0);
    assert.equal(empty.attributes.length, 0);
  }
  assert.equal(EMBLEM_DUST.sparkleMs, 4200);
  assert.equal(EMBLEM_DUST.settleMs, 1300);
});

test('independent flights cover every 3D octant with varied speeds and no radial direction bias', () => {
  const profile = emblemSamplingProfile(true);
  const { attributes, count } = sampleEmblemDust(fixture(profile.size), profile.size, profile.size, profile.particles);
  const octants = Array(8).fill(0), direction = [0, 0, 0];
  let radial = 0, slow = 0, fast = 0;
  for (let i = 0; i < count; i++) {
    const [x, y, , , , , vx, vy, vz] = attributes.subarray(i * 9, i * 9 + 9);
    const speed = Math.hypot(vx, vy, vz);
    assert.ok(speed >= .23999 && speed <= 1.39001);
    octants[(vx >= 0 ? 1 : 0) + (vy >= 0 ? 2 : 0) + (vz >= 0 ? 4 : 0)]++;
    direction[0] += vx / speed; direction[1] += vy / speed; direction[2] += vz / speed;
    radial += (x * vx + y * vy) / (Math.hypot(x, y) * speed);
    if (speed < .55) slow++;
    if (speed > 1.2) fast++;
  }
  assert.ok(octants.every(value => value / count > .09));
  assert.ok(direction.every(value => Math.abs(value / count) < .025));
  assert.ok(Math.abs(radial / count) < .03);
  assert.ok(slow / count > .1 && fast / count > .15);
});

test('dense profiles stay within the pixel and attribute memory budgets', () => {
  for (const compact of [false, true]) {
    const profile = emblemSamplingProfile(compact);
    const sample = sampleEmblemDust(fixture(profile.size), profile.size, profile.size, profile.particles);
    assert.equal(sample.count, profile.particles);
    assert.equal(sample.attributes.byteLength, profile.particles * 9 * 4);
    assert.ok(sample.attributes.byteLength <= 432000);
    assert.ok(profile.size <= 256);
  }
  assert.equal(EMBLEM_DUST.desktopParticles, 12000);
  assert.equal(EMBLEM_DUST.compactParticles, 4000);
  assert.equal(EMBLEM_DUST.maxPixels, 1500000);
});

test('compact density still samples real pixels from all four arms', () => {
  const profile = emblemSamplingProfile(true), rgba = fixture(profile.size);
  const sample = sampleEmblemDust(rgba, profile.size, profile.size, profile.particles);
  const counts = [0, 0, 0, 0];
  for (let i = 0; i < sample.count; i++) {
    const point = sample.attributes.subarray(i * 9, i * 9 + 9);
    const x = Math.floor((point[0] + 1) * .5 * profile.size), y = Math.floor((1 - point[1]) * .5 * profile.size);
    assert.equal(rgba[(y * profile.size + x) * 4 + 3], 255);
    counts[(point[0] >= 0 ? 1 : 0) + (point[1] >= 0 ? 2 : 0)]++;
  }
  assert.ok(counts.every(count => count / sample.count > .2));
});

test('transparent and sparse artwork never invents particle origins', () => {
  const empty = sampleEmblemDust(new Uint8ClampedArray(16 * 16 * 4), 16, 16);
  assert.equal(empty.count, 0);
  assert.equal(empty.attributes.length, 0);
});

test('fragment texture and particle release use identical locally coherent bytes', () => {
  const noise = createEmblemNoise(), size = EMBLEM_DUST.noiseSize;
  assert.equal(size, 512);
  assert.equal(noise.length, size * size);
  const values = new Set();
  let nearDifference = 0, farDifference = 0;
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const px = x * 7, py = y * 7, value = noise[py * size + px];
    assert.equal(value, emblemFragmentByte(px, py));
    values.add(value);
    nearDifference += Math.abs(value - noise[py * size + px + 1]);
    farDifference += Math.abs(value - noise[py * size + px + 24]);
  }
  assert.ok(values.size > 250, 'fragments must retain a broad release range');
  assert.ok(nearDifference / (64 * 64 * 255) < .05, 'neighbours should peel off together');
  assert.ok(farDifference > nearDifference * 4, 'small patches should remain distinct across the X');
  for (const [u, v] of [[.03, .17], [.43, .27], [.62, .73], [.92, .94]]) {
    const cell = Math.floor(v * size) * size + Math.floor(u * size);
    assert.equal(emblemReleaseScore(u, v), noise[cell] / 255);
  }
});
