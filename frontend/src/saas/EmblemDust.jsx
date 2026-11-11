import { useEffect, useRef } from 'react';
import { EMBLEM_DUST, createEmblemNoise, emblemDissolve, emblemSamplingProfile, sampleEmblemDust, selectEmblemStars } from './emblemDustModel';

const vertex = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = vec2(aPosition.x * .5 + .5, .5 - aPosition.y * .5);
  gl_Position = vec4(aPosition / 1.65, 0., 1.);
}`;
const material = `
precision highp float;
uniform sampler2D uImage;
uniform sampler2D uNoise;
uniform float uDissolve;
varying vec2 vUv;
float releaseScore(vec2 uv) {
  vec2 cell = clamp(floor(uv * 512.), vec2(0.), vec2(511.));
  return texture2D(uNoise, (cell + .5) / 512.).r;
}
void main() {
  vec4 colour = texture2D(uImage, vUv);
  float score = releaseScore(vUv);
  // Hand the clean surface to the point representation. Cutting opaque holes
  // through a flat image reads as damage rather than particles detaching.
  float keep = 1. - smoothstep(.025, .48, uDissolve);
  float localKeep = smoothstep(uDissolve - .12, uDissolve + .12, score);
  keep *= mix(1., .94 + localKeep * .06, smoothstep(0., .18, uDissolve));
  gl_FragColor = vec4(colour.rgb, colour.a * keep);
}`;
const particleVertex = `
precision highp float;
attribute vec2 aOrigin;
attribute float aScore;
attribute vec3 aColour;
attribute vec3 aVelocity;
uniform float uProgress;
uniform float uIdle;
uniform float uSparkleIdle;
uniform float uStarPass;
uniform float uTime;
uniform float uPixelRatio;
varying vec3 vColour;
varying float vAlpha;
varying float vGlint;
varying float vBlur;
vec2 rotatePoint(vec2 point, float angle) {
  float cosine = cos(angle), sine = sin(angle);
  return vec2(cosine * point.x - sine * point.y, sine * point.x + cosine * point.y);
}
void main() {
  float release = .12 + aScore * .44;
  float phaseAge = max(0., (uProgress - release) / .28);
  float detached = step(release, uProgress);
  // Idle changes the light, not the trajectory, so restarting a scroll never
  // pulls a lingering star backwards along its flight.
  float age = clamp(phaseAge, 0., 1.35) * detached;

  // CSS rotates clockwise in screen coordinates; the GL plane has y pointing
  // up. Freeze each birth on the actual rotating material, fly in world space,
  // then counter-rotate so detached points do not spin as a single cloud.
  float spin = min(uProgress / .52, 1.) * 9.42477796;
  float birthSpin = min(min(release, uProgress) / .52, 1.) * 9.42477796;
  vec2 birth = rotatePoint(aOrigin, -birthSpin);
  vec3 seed = fract(aVelocity.zxy * vec3(13.731, 17.123, 23.789) + aVelocity.yzx * vec3(31.37, 19.19, 43.17));
  vec3 bend = vec3(sin(seed.x * 6.2831853), cos(seed.y * 6.2831853), sin(seed.z * 6.2831853));
  float departure = smoothstep(0., .15, age);
  // A clear initial separation gives way to independent inertial drift. Dust
  // leaves the silhouette before dimming instead of crowding its surface.
  float flight = (1. - exp(-age * 2.8)) * .85 + age * .68;
  vec3 world = vec3(birth, 0.) + aVelocity * flight;
  world += bend * sin(age * 2.4) * age * (.035 + seed.z * .09);
  float perspective = 1. / max(.65, 1. + world.z * .25);
  vec2 position = rotatePoint(world.xy * perspective, spin);
  // Stagger the soft fade per point so the bounded canvas has no visible rim.
  float boundary = 1. - smoothstep(1.23 + seed.y * .12, 1.63, length(position));
  gl_Position = vec4(position / 1.65, 0., 1.);

  vBlur = smoothstep(.5, 1.8, abs(world.z)) * departure;
  vGlint = 0.;
  float nearGrain = smoothstep(.935, .985, seed.x) * departure;
  float diameter = (1.12 + seed.x * .72 + nearGrain * .9) * perspective + vBlur * 1.3;
  diameter = mix(1.55 + seed.x * .4, diameter, departure);
  gl_PointSize = diameter * uPixelRatio;
  float fade = 1. - smoothstep(.88, 1.55, phaseAge);
  fade *= (1. - smoothstep(.35, 1., uIdle)) * (1. - smoothstep(.68, .78, uProgress));
  float shimmer = .92 + .08 * sin(uTime * (1. + seed.y * 1.5) + seed.z * 30.);
  float attachedReveal = smoothstep(.17, .30, uProgress);
  float releasedReveal = smoothstep(.13, .20, uProgress);
  float releasedAlpha = fade * shimmer * (.78 + seed.z * .22) * releasedReveal;
  vAlpha = mix(attachedReveal * .95, releasedAlpha, detached) * boundary * mix(1., .7, vBlur);
  vec3 cool = mix(vec3(.34, .57, 1.), vec3(.67, .53, .96), seed.y);
  vec3 pigment = mix(aColour, cool, departure * .78);
  vec3 releasedColour = mix(pigment, vec3(.9, .96, 1.), .46 + seed.x * .34);
  vColour = mix(aColour, releasedColour, departure);

  // A sparse second pass gives glitter its own visible core and afterglow.
  // Its birth and trajectory match the dust exactly; only its light differs.
  if (uStarPass > .5) {
    float wave = .5 + .5 * sin(uTime * (3.2 + seed.x * 1.6) + seed.y * 62.831853);
    float sparkle = pow(wave, 4.);
    float afterglow = 1. - smoothstep(.55, 1., uSparkleIdle);
    afterglow *= 1. - smoothstep(.69, .78, uProgress);
    vAlpha = detached * smoothstep(.025, .12, age) * boundary * afterglow;
    vAlpha *= (.22 + sparkle * .78) * mix(1., .75, vBlur);
    vGlint = 1.;
    vColour = mix(vec3(.57, .67, 1.), vec3(.98, .98, 1.), .4 + sparkle * .6);
    gl_PointSize = (6. + sparkle * (8. + seed.y * 4.)) * clamp(perspective, .85, 1.15) * uPixelRatio;
  }
}`;
const particleFragment = `
precision mediump float;
varying vec3 vColour;
varying float vAlpha;
varying float vGlint;
varying float vBlur;
void main() {
  vec2 point = gl_PointCoord * 2. - 1.;
  float radius = length(point);
  float core = 1. - smoothstep(.18, mix(.86, 1., vBlur), radius);
  float halo = exp(-radius * radius * mix(7., 3.5, vBlur)) * .16;
  float rayX = exp(-point.y * point.y * 220.) * pow(max(0., 1. - abs(point.x)), 2.2);
  float rayY = exp(-point.x * point.x * 220.) * pow(max(0., 1. - abs(point.y)), 2.2);
  float star = exp(-radius * radius * 28.) + (rayX + rayY) * .44;
  star += exp(-radius * radius * 7.) * .16;
  float shape = mix(core + halo, star, vGlint);
  gl_FragColor = vec4(vColour, clamp(shape * vAlpha, 0., 1.));
}`;

function createProgram(gl, vertexSource, fragmentSource) {
  const shaders = [];
  const program = gl.createProgram();
  for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      shaders.forEach(item => gl.deleteShader(item));
      gl.deleteProgram(program);
      throw new Error('Dust shader unavailable');
    }
    shaders.push(shader);
    gl.attachShader(program, shader);
  }
  gl.linkProgram(program);
  shaders.forEach(shader => { gl.detachShader(program, shader); gl.deleteShader(shader); });
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    throw new Error('Dust material unavailable');
  }
  return program;
}

export default function EmblemDust() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const sculpture = canvas.closest('.sos-emblem-sculpture');
    const surface = canvas.closest('#workspace');
    const image = sculpture?.querySelector('.sos-emblem-solid');
    if (!sculpture || !surface || !image) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const compact = window.matchMedia('(max-width: 850px), (pointer: coarse)');
    let gl, resources, sample, frame = 0, destroyed = false, lost = false, unavailable = false;
    let sampleCompact = compact.matches, sampleWait = 0, sampleWaitIsIdle = false;
    let visible = true, resizeNeeded = true, progress = 0, lastChange = 0, lastDraw = 0;
    let pixelRatio = 1, width = 0, height = 0, draws = 0;
    canvas.dataset.dustDraws = '0';

    function deactivate(state) {
      window.cancelAnimationFrame(frame);
      frame = 0;
      sculpture.dataset.dustActive = 'false';
      canvas.dataset.dustState = state;
    }
    function destroyResources() {
      if (!gl || !resources) return;
      gl.deleteBuffer(resources.quad);
      gl.deleteBuffer(resources.points);
      gl.deleteBuffer(resources.stars);
      gl.deleteTexture(resources.texture);
      gl.deleteTexture(resources.noise);
      gl.deleteProgram(resources.material);
      gl.deleteProgram(resources.particles);
      resources = null;
    }
    function prepareSample() {
      if (sample && sampleCompact === compact.matches) return true;
      if (!image.complete || !image.naturalWidth) return false;
      const profile = emblemSamplingProfile(compact.matches);
      const sampler = document.createElement('canvas');
      sampler.width = sampler.height = profile.size;
      const context = sampler.getContext('2d', { willReadFrequently: true });
      if (!context) throw new Error('Sample unavailable');
      context.drawImage(image, 0, 0, profile.size, profile.size);
      sample = sampleEmblemDust(context.getImageData(0, 0, profile.size, profile.size).data, profile.size, profile.size, profile.particles);
      sampleCompact = compact.matches;
      canvas.dataset.dustSampleSize = String(profile.size);
      if (!sample.count) throw new Error('Transparent material');
      return true;
    }
    function warmSample() {
      if (sample || sampleWait || unavailable || !image.complete || !image.naturalWidth) return;
      const prepare = () => {
        sampleWait = 0;
        if (!allowed()) return;
        try { prepareSample(); } catch { unavailable = true; deactivate('fallback'); }
      };
      sampleWaitIsIdle = typeof window.requestIdleCallback === 'function';
      sampleWait = sampleWaitIsIdle ? window.requestIdleCallback(prepare, { timeout: 350 }) : window.setTimeout(prepare, 160);
    }
    function initialise() {
      if (resources) return true;
      if (lost || unavailable || !image.complete || !image.naturalWidth) return false;
      try {
        gl ||= canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'low-power' });
        if (!gl) throw new Error('WebGL unavailable');
        if (!prepareSample()) return false;
        resources = { material: null, particles: null, quad: null, points: null, stars: null, starCount: 0, texture: null, noise: null, validated: false };
        canvas.dataset.dustValidated = 'false';
        const precision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
        resources.material = createProgram(gl, vertex, precision?.precision ? material : material.replace('precision highp float;', 'precision mediump float;'));
        resources.particles = createProgram(gl, particleVertex, particleFragment);
        resources.quad = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.quad);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        resources.points = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.points);
        gl.bufferData(gl.ARRAY_BUFFER, sample.attributes, gl.STATIC_DRAW);
        const stars = selectEmblemStars(sample, compact.matches);
        resources.stars = gl.createBuffer();
        resources.starCount = stars.count;
        gl.bindBuffer(gl.ARRAY_BUFFER, resources.stars);
        gl.bufferData(gl.ARRAY_BUFFER, stars.attributes, gl.STATIC_DRAW);
        resources.texture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, resources.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        resources.noise = gl.createTexture();
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, resources.noise);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, EMBLEM_DUST.noiseSize, EMBLEM_DUST.noiseSize, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, createEmblemNoise());
        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        resizeNeeded = true;
        sculpture.dataset.dustRenderer = 'webgl';
        return true;
      } catch {
        unavailable = true;
        destroyResources();
        delete sculpture.dataset.dustRenderer;
        deactivate('fallback');
        return false;
      }
    }
    function resize() {
      const cssWidth = canvas.clientWidth, cssHeight = canvas.clientHeight;
      if (!cssWidth || !cssHeight) return false;
      const maximum = Math.min(EMBLEM_DUST.maxWidth, gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
      const ratio = Math.min(window.devicePixelRatio || 1, EMBLEM_DUST.maxDpr, maximum / cssWidth, maximum / cssHeight, Math.sqrt(EMBLEM_DUST.maxPixels / (cssWidth * cssHeight)));
      width = Math.max(1, Math.floor(cssWidth * ratio));
      height = Math.max(1, Math.floor(cssHeight * ratio));
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
      pixelRatio = width / cssWidth;
      canvas.dataset.dustBuffer = `${width}x${height}`;
      resizeNeeded = false;
      return true;
    }
    function bindAttribute(program, name, size, stride, offset) {
      const location = gl.getAttribLocation(program, name);
      if (location < 0) return;
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
    }
    function allowed() {
      return !destroyed && !document.hidden && visible && !lost && !reduced.matches
        && surface.dataset.heroPaused !== 'true' && surface.dataset.heroRunning !== 'false'
        && surface.dataset.heroIntro !== 'arriving' && surface.dataset.heroScrubMode === 'pinned';
    }
    function draw(now) {
      frame = 0;
      if (!allowed() || progress < .10 || progress > EMBLEM_DUST.lastParticle) { sync(); return; }
      if (now - lastDraw < 1000 / 30) { frame = window.requestAnimationFrame(draw); return; }
      if (!initialise() || (resizeNeeded && !resize())) return;
      lastDraw = now;
      const idle = Math.min(1, Math.max(0, (now - lastChange) / EMBLEM_DUST.settleMs));
      const sparkleIdle = Math.min(1, Math.max(0, (now - lastChange) / EMBLEM_DUST.sparkleMs));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(resources.material);
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.quad);
      bindAttribute(resources.material, 'aPosition', 2, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, resources.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, resources.noise);
      gl.uniform1i(gl.getUniformLocation(resources.material, 'uImage'), 0);
      gl.uniform1i(gl.getUniformLocation(resources.material, 'uNoise'), 1);
      gl.uniform1f(gl.getUniformLocation(resources.material, 'uDissolve'), emblemDissolve(progress));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      gl.useProgram(resources.particles);
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.points);
      bindAttribute(resources.particles, 'aOrigin', 2, 36, 0);
      bindAttribute(resources.particles, 'aScore', 1, 36, 8);
      bindAttribute(resources.particles, 'aColour', 3, 36, 12);
      bindAttribute(resources.particles, 'aVelocity', 3, 36, 24);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uProgress'), progress);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uIdle'), idle);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uSparkleIdle'), sparkleIdle);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uStarPass'), 0);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uTime'), now / 1000);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uPixelRatio'), pixelRatio);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      const count = Math.min(sample.count, compact.matches ? EMBLEM_DUST.compactParticles : EMBLEM_DUST.desktopParticles);
      gl.drawArrays(gl.POINTS, 0, count);
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.stars);
      bindAttribute(resources.particles, 'aOrigin', 2, 36, 0);
      bindAttribute(resources.particles, 'aScore', 1, 36, 8);
      bindAttribute(resources.particles, 'aColour', 3, 36, 12);
      bindAttribute(resources.particles, 'aVelocity', 3, 36, 24);
      gl.uniform1f(gl.getUniformLocation(resources.particles, 'uStarPass'), 1);
      gl.drawArrays(gl.POINTS, 0, resources.starCount);
      if (gl.isContextLost()) return;
      if (!resources.validated) {
        if (gl.getError() !== gl.NO_ERROR) {
          unavailable = true;
          destroyResources();
          delete sculpture.dataset.dustRenderer;
          deactivate('fallback');
          return;
        }
        resources.validated = true;
        canvas.dataset.dustValidated = 'true';
      }
      sculpture.dataset.dustActive = 'true';
      const twinkling = progress > EMBLEM_DUST.start && sparkleIdle < 1;
      canvas.dataset.dustState = idle < 1 ? 'dispersing' : twinkling ? 'twinkling' : 'settled';
      canvas.dataset.dustParticleCount = String(count);
      canvas.dataset.dustStarCount = String(resources.starCount);
      canvas.dataset.dustProgress = progress.toFixed(4);
      canvas.dataset.dustDraws = String(++draws);
      if (idle < 1 || twinkling) frame = window.requestAnimationFrame(draw);
    }
    function sync() {
      if (!allowed()) {
        const state = lost ? 'context-lost' : reduced.matches ? 'reduced' : document.hidden || !visible ? 'suspended' : 'static';
        deactivate(state);
        return;
      }
      if (progress < .10 || progress > EMBLEM_DUST.lastParticle) { warmSample(); deactivate('idle'); return; }
      if (!frame && !unavailable) frame = window.requestAnimationFrame(draw);
    }
    function scrollChanged(event) {
      const next = Math.max(0, Math.min(1, Number(event.detail?.progress) || 0));
      if (Math.abs(next - progress) > .00001) lastChange = performance.now();
      progress = next;
      sync();
    }
    function resized() { resizeNeeded = true; sync(); }
    function profileChanged() {
      if (sampleCompact !== compact.matches) {
        destroyResources();
        sample = null;
        sampleCompact = compact.matches;
      }
      resized();
    }
    function contextLost(event) {
      event.preventDefault();
      lost = true;
      resources = null;
      canvas.dataset.dustValidated = 'false';
      delete sculpture.dataset.dustRenderer;
      deactivate('context-lost');
    }
    function contextRestored() {
      lost = false;
      unavailable = false;
      resizeNeeded = true;
      lastDraw = 0;
      sync();
    }
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(entries => {
      visible = entries.some(entry => entry.isIntersecting);
      sync();
    }, { threshold: .01 }) : null;
    observer?.observe(surface.querySelector('.sos-hero-pin') || surface);
    const attributes = new MutationObserver(sync);
    attributes.observe(surface, { attributes: true, attributeFilter: ['data-hero-paused', 'data-hero-running', 'data-hero-intro', 'data-hero-scrub-mode'] });
    const resizer = typeof ResizeObserver === 'function' ? new ResizeObserver(resized) : null;
    resizer?.observe(canvas);
    canvas.addEventListener('webglcontextlost', contextLost);
    canvas.addEventListener('webglcontextrestored', contextRestored);
    surface.addEventListener('sos:hero-scroll', scrollChanged);
    image.addEventListener('load', sync);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', resized);
    reduced.addEventListener('change', sync);
    compact.addEventListener('change', profileChanged);
    progress = Number(getComputedStyle(surface).getPropertyValue('--hero-scroll-progress')) || 0;
    lastChange = performance.now();
    sync();
    return () => {
      destroyed = true;
      if (sampleWaitIsIdle) window.cancelIdleCallback?.(sampleWait);
      else window.clearTimeout(sampleWait);
      deactivate('disposed');
      observer?.disconnect();
      attributes.disconnect();
      resizer?.disconnect();
      canvas.removeEventListener('webglcontextlost', contextLost);
      canvas.removeEventListener('webglcontextrestored', contextRestored);
      surface.removeEventListener('sos:hero-scroll', scrollChanged);
      image.removeEventListener('load', sync);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('resize', resized);
      reduced.removeEventListener('change', sync);
      compact.removeEventListener('change', profileChanged);
      destroyResources();
      delete sculpture.dataset.dustRenderer;
      delete sculpture.dataset.dustActive;
    };
  }, []);
  return <canvas className="sos-emblem-dust" ref={canvasRef} aria-hidden="true" />;
}
