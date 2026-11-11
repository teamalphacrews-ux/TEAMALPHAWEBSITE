export const EMBLEM_DUST = Object.freeze({
  extent: 1.65,
  start: .12,
  end: .56,
  lastParticle: .78,
  lifetime: .28,
  settleMs: 1300,
  sparkleMs: 4200,
  desktopParticles: 12000,
  compactParticles: 4000,
  desktopStars: 96,
  compactStars: 32,
  desktopSampleSize: 256,
  compactSampleSize: 144,
  maxPixels: 1500000,
  maxWidth: 1800,
  maxDpr: 1.5,
  noiseSize: 512,
});

const clamp = value => Math.max(0, Math.min(1, value));

export function emblemSamplingProfile(compact = false) {
  return compact
    ? { size: EMBLEM_DUST.compactSampleSize, particles: EMBLEM_DUST.compactParticles }
    : { size: EMBLEM_DUST.desktopSampleSize, particles: EMBLEM_DUST.desktopParticles };
}

export function emblemNoiseByte(x, y) {
  let hash = (Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177) >>> 0;
  return ((hash ^ (hash >>> 16)) >>> 24) & 255;
}

function smoothNoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const tx = x - ix, ty = y - iy;
  const sx = tx * tx * tx * (tx * (tx * 6 - 15) + 10);
  const sy = ty * ty * ty * (ty * (ty * 6 - 15) + 10);
  const top = emblemNoiseByte(ix, iy) * (1 - sx) + emblemNoiseByte(ix + 1, iy) * sx;
  const bottom = emblemNoiseByte(ix, iy + 1) * (1 - sx) + emblemNoiseByte(ix + 1, iy + 1) * sx;
  return (top * (1 - sy) + bottom * sy) / 255;
}

// Overlapping smooth scales make irregular fragments, rather than noisy holes
// or visible cell boundaries. Rotated detail keeps the patches non-directional.
export function emblemFragmentByte(x, y) {
  const scale = EMBLEM_DUST.noiseSize;
  const broad = smoothNoise((x + 37) * 24 / scale, (y + 71) * 24 / scale);
  const detail = smoothNoise((x * .84 + y * .54 + 113) * 57 / scale, (y * .84 - x * .54 + 227) * 57 / scale);
  const grain = emblemNoiseByte(x, y) / 255;
  const field = broad * .45 + detail * .53 + grain * .02;
  return Math.round(clamp((field - .5) * 1.9 + .5) * 255);
}

export function createEmblemNoise() {
  const size = EMBLEM_DUST.noiseSize;
  const noise = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) noise[y * size + x] = emblemFragmentByte(x, y);
  return noise;
}

export function emblemDissolve(progress) {
  return clamp((progress - EMBLEM_DUST.start) / (EMBLEM_DUST.end - EMBLEM_DUST.start));
}

// The material shader reads these exact fragment texels. Release is independent
// of distance from the centre or arm, but neighbouring pixels leave together.
export function emblemReleaseScore(u, v) {
  const cellX = Math.min(EMBLEM_DUST.noiseSize - 1, Math.max(0, Math.floor(u * EMBLEM_DUST.noiseSize)));
  const cellY = Math.min(EMBLEM_DUST.noiseSize - 1, Math.max(0, Math.floor(v * EMBLEM_DUST.noiseSize)));
  return emblemFragmentByte(cellX, cellY) / 255;
}

export function sampleEmblemDust(rgba, width, height, maximum = EMBLEM_DUST.desktopParticles) {
  const candidates = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * 4;
      if (rgba[offset + 3] < 180) continue;
      const u = (x + .5) / width, v = (y + .5) / height;
      candidates.push({ u, v, offset });
    }
  }
  let seed = 193307;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  // Shuffle before capping so the compact prefix covers every arm of the X.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const count = Math.min(maximum, candidates.length);
  const attributes = new Float32Array(count * 9);
  for (let i = 0; i < count; i++) {
    const { u, v, offset } = candidates[i];
    // Uniform sphere directions, independently seeded speeds: no source-space
    // lanes, common destination, or outward-from-centre bias.
    const angle = random() * Math.PI * 2;
    const depth = random() * 2 - 1;
    const speed = .24 + Math.pow(random(), .65) * 1.15;
    const planar = Math.sqrt(1 - depth * depth) * speed;
    attributes.set([
      u * 2 - 1, 1 - v * 2,
      emblemReleaseScore(u, v),
      rgba[offset] / 255, rgba[offset + 1] / 255, rgba[offset + 2] / 255,
      Math.cos(angle) * planar, Math.sin(angle) * planar, depth * speed,
    ], i * 9);
  }
  return { attributes, count };
}

export function selectEmblemStars(sample, compact = false) {
  const available = Math.min(sample.count, Math.floor(sample.attributes.length / 9));
  const count = Math.min(available, compact ? EMBLEM_DUST.compactStars : EMBLEM_DUST.desktopStars);
  const attributes = new Float32Array(count * 9);
  // The source is already shuffled. An even stride keeps this sparse subset
  // stable and spread across the actual artwork without duplicating a pixel.
  for (let i = 0; i < count; i++) {
    const offset = Math.floor(i * available / count) * 9;
    attributes.set(sample.attributes.subarray(offset, offset + 9), i * 9);
  }
  return { attributes, count };
}
