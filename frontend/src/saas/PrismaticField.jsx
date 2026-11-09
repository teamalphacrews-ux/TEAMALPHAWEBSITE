import { useEffect, useRef } from 'react';
import { PRODUCT_BRAND } from './productBrandAssets';

const VERTEX = `
attribute vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }
`;

// Analytic annular surfaces form a dimensional optical engine. Each broad
// surface shades its curved cross-section; no mesh, ray-march or post pipeline.
const FRAGMENT = `
uniform vec2 u_resolution;
uniform vec2 u_pointer;
uniform float u_time;
uniform float u_scroll;
uniform float u_apertureScale;
uniform float u_motion;
uniform float u_hasLogo;
uniform sampler2D u_logo;

float edgeFootprint(float value, float analyticFootprint) {
  #ifdef HAS_DERIVATIVES
    return max(0.00001, max(fwidth(value) * 0.75, analyticFootprint * 0.5));
  #else
    return max(0.00001, analyticFootprint);
  #endif
}

vec3 illumination(vec3 direction) {
  float phase = u_time * 0.21;
  vec3 blueLight = normalize(vec3(-0.62 + sin(phase) * 0.35, 0.72, 0.86));
  vec3 opalLight = normalize(vec3(0.62, 0.48 + cos(phase * 0.78) * 0.2, 0.9));
  vec3 travellingLight = normalize(vec3(cos(phase + 0.4) * 0.85, sin(phase + 0.4) * 0.55, 0.65));
  float blue = pow(max(dot(direction, blueLight), 0.0), 18.0);
  float violet = pow(max(dot(direction, opalLight), 0.0), 28.0);
  float strip = pow(max(dot(direction, travellingLight), 0.0), 90.0);
  return vec3(0.035, 0.045, 0.075)
    + vec3(0.25, 0.48, 1.0) * blue * 1.35
    + vec3(0.73, 0.55, 1.0) * violet * 1.18
    + vec3(0.65, 0.81, 1.0) * strip * 1.8;
}

vec3 stageMaterial(vec3 ro, vec3 rd, vec3 point) {
  vec2 pool = point.xz * vec2(0.38, 0.14);
  float spread = exp(-dot(pool, pool) * 1.65);
  vec3 reflected = reflect(rd, vec3(0.0, 1.0, 0.0));
  vec3 color = vec3(0.014, 0.022, 0.04) + illumination(reflected) * 0.14 * spread;
  color += mix(vec3(0.06, 0.13, 0.32), vec3(0.19, 0.09, 0.3), smoothstep(-3.0, 3.0, point.x)) * spread * 0.35;
  float travel = (-0.15 - point.z) / reflected.z;
  vec3 imagePoint = point + reflected * travel;
  vec2 logoUV = (imagePoint.xy - vec2(0.0, 0.36)) / 3.65 + 0.5;
  if (travel > 0.0 && logoUV.x > 0.0 && logoUV.x < 1.0 && logoUV.y > 0.0 && logoUV.y < 1.0) {
    vec4 logo = texture2D(u_logo, logoUV);
    logo += texture2D(u_logo, logoUV + vec2(0.006, 0.0));
    logo += texture2D(u_logo, logoUV - vec2(0.006, 0.0));
    logo /= 3.0;
    float fresnel = 0.1 + 0.18 * pow(1.0 - clamp(dot(normalize(ro - point), vec3(0.0, 1.0, 0.0)), 0.0, 1.0), 3.0);
    color = mix(color, logo.rgb * 0.5, logo.a * fresnel * u_hasLogo);
  }
  // A low polished platform has a physical bevel, without adding UI linework.
  float platform = length(point.xz * vec2(0.48, 0.25));
  color += vec3(0.12, 0.2, 0.38) * exp(-abs(platform - 1.0) * 38.0) * 0.35;
  return color;
}

vec4 engineCavity(vec3 ro, vec3 rd, vec3 center) {
  vec3 origin = ro - center;
  float radius = 1.57 + u_scroll * 0.24;
  float a = dot(rd.xy, rd.xy);
  float b = dot(origin.xy, rd.xy);
  float c = dot(origin.xy, origin.xy) - radius * radius;
  float discriminant = b * b - a * c;
  if (a < 0.0001) return vec4(0.0);
  float silhouetteAA = edgeFootprint(discriminant, radius * length(origin) / (u_resolution.y * 1.62 * u_apertureScale));
  float silhouette = smoothstep(-silhouetteAA, silhouetteAA, discriminant);
  float travel = (-b + sqrt(max(0.0, discriminant))) / a;
  vec3 point = origin + rd * travel;
  float depthAA = edgeFootprint(point.z, travel / (u_resolution.y * 1.62 * u_apertureScale * max(a, 0.035)));
  if (silhouette <= 0.0 || travel < 0.0) return vec4(0.0);
  float coverage = silhouette * smoothstep(-3.3 - depthAA, -3.3 + depthAA, point.z)
    * (1.0 - smoothstep(-0.25 - depthAA, -0.25 + depthAA, point.z));
  if (coverage <= 0.0) return vec4(0.0);
  vec3 normal = -normalize(vec3(point.xy, 0.0));
  float angle = atan(point.y, point.x);
  float depth = clamp((point.z + 3.3) / 3.05, 0.0, 1.0);
  vec3 pigment = mix(vec3(0.06, 0.1, 0.2), vec3(0.15, 0.08, 0.23), smoothstep(-1.0, 1.0, sin(angle)));
  vec3 color = pigment * (0.24 + depth * 0.4);
  color += illumination(reflect(rd, normal)) * (0.08 + depth * 0.12);
  float lightDistance = (point.z + 2.65 + sin(u_time * 0.18) * 0.25) * 5.0;
  float lightWell = exp(-lightDistance * lightDistance);
  color += vec3(0.13, 0.28, 0.65) * lightWell * 0.48;
  return vec4(color, coverage);
}

vec4 opticalRing(vec3 ro, vec3 rd, vec3 center, vec3 normal, float radius, float width, float hue, float energy) {
  normal = normalize(normal);
  vec3 tangent = normalize(cross(vec3(0.0, 1.0, 0.0), normal));
  vec3 bitangent = cross(normal, tangent);
  float denominator = dot(rd, normal);
  if (abs(denominator) < 0.001) return vec4(0.0);
  float travel = dot(center - ro, normal) / denominator;
  if (travel < 0.0) return vec4(0.0);
  vec3 point = ro + rd * travel;
  vec2 q = vec2(dot(point - center, tangent), dot(point - center, bitangent));
  float radial = length(q);
  float distance = radial - radius;
  float edge = width - abs(distance);
  float aa = edgeFootprint(distance, travel / (u_resolution.y * 1.62 * u_apertureScale * max(abs(denominator), 0.18)));
  float alpha = smoothstep(-aa, aa, edge);
  if (alpha <= 0.0) return vec4(0.0);

  float crossSection = clamp(distance / width, -1.0, 1.0);
  vec3 outward = (tangent * q.x + bitangent * q.y) / max(radial, 0.001);
  vec3 curvedNormal = normalize(normal * sqrt(max(0.001, 1.0 - crossSection * crossSection)) + outward * crossSection * 0.88);
  vec3 reflected = reflect(rd, curvedNormal);
  float fresnel = 0.08 + 0.92 * pow(max(0.0, 1.0 - abs(dot(-rd, curvedNormal))), 4.0);
  vec3 pigment = mix(vec3(0.075, 0.13, 0.25), vec3(0.18, 0.11, 0.26), hue);
  vec3 color = pigment * (0.38 + 0.4 * max(dot(curvedNormal, normalize(vec3(-0.6, 0.9, 1.0))), 0.0));
  color += illumination(reflected) * (0.28 + fresnel * 0.85) * energy;
  float bevel = 1.0 - smoothstep(-aa, max(0.018, aa * 2.0), edge);
  color += mix(vec3(0.2, 0.46, 0.91), vec3(0.68, 0.46, 0.94), hue) * bevel * 0.52;

  // Light travels across a solid curved body, rather than drawing neon outlines.
  float angle = atan(q.y, q.x);
  float caustic = pow(max(0.0, cos(angle - u_time * 0.23 - hue * 2.8)), 26.0);
  color += mix(vec3(0.23, 0.52, 1.0), vec3(0.76, 0.55, 1.0), hue) * caustic * (0.15 + fresnel * 0.5) * energy;
  return vec4(color, alpha);
}

vec3 composite(vec3 base, vec4 surface) { return mix(base, surface.rgb, surface.a); }

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
  vec3 ro = vec3(u_pointer.x * 0.22, 0.55 + u_pointer.y * 0.1, 5.1);
  vec3 forward = normalize(vec3(0.0, -0.05, -0.2) - ro);
  vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, forward);
  // Expand the actual ray-projected geometry at native output resolution.
  // The CSS fallback may scale, but the live canvas never magnifies its bitmap.
  vec2 apertureCenter = vec2(0.0, 0.13);
  vec2 rayUV = (uv - apertureCenter) / u_apertureScale + apertureCenter;
  vec3 rd = normalize(forward * 1.62 + rayUV.x * right + rayUV.y * up);
  float arrival = mix(1.0, smoothstep(0.0, 1.8, u_time), u_motion);
  float opening = 0.87 + arrival * 0.13 + u_scroll * 0.19;
  float phase = u_time * 0.12;
  vec3 color = vec3(0.019, 0.026, 0.044);

  // Receding light wells give the engine depth before the four material planes.
  float center = length((uv - vec2(0.0, 0.14)) * vec2(0.82, 1.0));
  color += vec3(0.035, 0.07, 0.18) * exp(-center * center * 5.0);
  color += vec3(0.05, 0.035, 0.12) * exp(-dot(uv - vec2(0.45, 0.1), uv - vec2(0.45, 0.1)) * 5.0);
  if (rd.y < -0.001) {
    float travel = (-1.1 - ro.y) / rd.y;
    color = mix(color, stageMaterial(ro, rd, ro + rd * travel), smoothstep(0.0, 0.12, -rd.y));
  }

  vec3 engine = vec3(0.0, 0.44, -0.62);
  color = composite(color, engineCavity(ro, rd, engine));
  color = composite(color, opticalRing(ro, rd, engine + vec3(0.0, 0.0, -1.28), vec3(0.04, 0.12, 1.0), 1.57 * opening, 0.28, 0.45, 0.5));
  color = composite(color, opticalRing(ro, rd, engine + vec3(0.0, 0.0, -0.5), vec3(0.18, -0.24, 1.0), 1.76 * opening, 0.18, 0.1, 0.84));
  color = composite(color, opticalRing(ro, rd, engine + vec3(0.0, 0.0, 0.25), vec3(-0.25, 0.33, 1.0), 1.91 * opening, 0.105, 0.82, 0.95));
  color = composite(color, opticalRing(ro, rd, engine + vec3(0.0, 0.02, 0.6), vec3(0.42 + sin(phase) * 0.06, -0.17 + cos(phase) * 0.12, 1.0), 1.48 * opening, 0.075, 0.28, 1.12));

  // Keep the lower reading plane quiet while the material remains luminous above.
  float readingPlane = smoothstep(-0.31, 0.2, uv.y);
  color *= mix(0.22, 1.0, readingPlane);
  color *= 1.0 - smoothstep(0.8, 1.7, abs(uv.x)) * 0.55;
  gl_FragColor = vec4(pow(max(color, vec3(0.0)), vec3(0.94)), 1.0);
}
`;

export default function PrismaticField() {
  const field = useRef(null);
  const canvas = useRef(null);

  useEffect(() => {
    const surface = field.current;
    const element = canvas.current;
    const scene = surface.closest('.sos-launch');
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const desktop = window.matchMedia('(min-width: 851px) and (pointer: fine)');
    let gl;
    try {
      gl = element.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    } catch { return; }
    if (!gl) return;
    const viewportLimits = gl.getParameter(gl.MAX_VIEWPORT_DIMS);
    const renderbufferLimit = gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) || 4096;

    let disposed = false;
    let lost = false;
    let visible = true;
    let frame = 0;
    let scrollFrame = 0;
    let lastTime = 0;
    let elapsed = 0;
    const initialProgress = Number.parseFloat(getComputedStyle(scene).getPropertyValue('--hero-scroll-progress'));
    let heroScrubDriven = Number.isFinite(initialProgress);
    let progress = heroScrubDriven ? Math.max(0, Math.min(1, initialProgress)) : 0;
    let currentProgress = progress;
    let apertureScale = Math.max(1, Math.min(3, Number.parseFloat(scene.style.getPropertyValue('--hero-aperture-scale')) || 1));
    let resources = null;
    const pointer = { x: 0, y: 0, currentX: 0, currentY: 0 };
    const image = new Image();
    image.decoding = 'async';

    function clearResources() {
      if (!resources || lost) { resources = null; return; }
      gl.deleteTexture(resources.texture);
      gl.deleteBuffer(resources.buffer);
      gl.deleteProgram(resources.program);
      resources = null;
    }

    function compile(type, source) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    }

    function uploadLogo() {
      if (!resources || disposed || lost || !image.complete || !image.naturalWidth) return;
      gl.bindTexture(gl.TEXTURE_2D, resources.texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      resources.hasLogo = true;
      draw();
    }

    function initialise() {
      clearResources();
      const vertex = compile(gl.VERTEX_SHADER, VERTEX);
      const highp = (gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision || 0) > 0;
      const derivatives = Boolean(gl.getExtension('OES_standard_derivatives'));
      const variants = [
        { precision: highp ? 'highp' : 'mediump', derivatives },
        { precision: highp ? 'highp' : 'mediump', derivatives: false },
        { precision: 'mediump', derivatives: false },
      ];
      const attempted = new Set();
      let fragment = null;
      for (const variant of variants) {
        const key = variant.precision + variant.derivatives;
        if (attempted.has(key)) continue;
        attempted.add(key);
        const extension = variant.derivatives ? '#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n' : '';
        fragment = compile(gl.FRAGMENT_SHADER, extension + `precision ${variant.precision} float;\n` + FRAGMENT);
        if (fragment) {
          surface.dataset.shaderPrecision = variant.precision;
          surface.dataset.edgeAa = variant.derivatives ? 'derivatives' : 'pixel-footprint';
          break;
        }
      }
      if (!vertex || !fragment) {
        if (vertex) gl.deleteShader(vertex);
        if (fragment) gl.deleteShader(fragment);
        return false;
      }
      const program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return false; }
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 0]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      resources = { program, buffer, texture, hasLogo: false, uniforms: Object.fromEntries(['resolution', 'pointer', 'time', 'scroll', 'apertureScale', 'motion', 'hasLogo', 'logo'].map(name => [name, gl.getUniformLocation(program, `u_${name}`)])) };
      uploadLogo();
      return true;
    }

    function draw() {
      if (!resources || lost || disposed) return;
      gl.useProgram(resources.program);
      gl.uniform2f(resources.uniforms.resolution, element.width, element.height);
      gl.uniform2f(resources.uniforms.pointer, pointer.currentX, pointer.currentY);
      gl.uniform1f(resources.uniforms.time, elapsed / 1000);
      gl.uniform1f(resources.uniforms.scroll, currentProgress);
      const nativeAperture = desktop.matches && !reduced.matches;
      gl.uniform1f(resources.uniforms.apertureScale, nativeAperture ? apertureScale : 1);
      gl.uniform1f(resources.uniforms.motion, desktop.matches && !reduced.matches ? 1 : 0);
      gl.uniform1f(resources.uniforms.hasLogo, resources.hasLogo ? 1 : 0);
      gl.uniform1i(resources.uniforms.logo, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      surface.dataset.renderer = 'webgl';
      surface.dataset.apertureSampling = nativeAperture ? 'shader-native' : 'static-css';
      surface.dataset.apertureScale = (nativeAperture ? apertureScale : 1).toFixed(4);
    }

    function animated() { return desktop.matches && !reduced.matches && scene.dataset.heroPaused !== 'true' && scene.dataset.heroScrubVisible !== 'false' && visible && !document.hidden && !lost && resources; }
    function render(timestamp) {
      frame = 0;
      if (!animated()) return;
      if (timestamp - lastTime >= 1000 / 30) {
        elapsed += lastTime ? Math.min(timestamp - lastTime, 70) : 33;
        lastTime = timestamp;
        pointer.currentX += (pointer.x - pointer.currentX) * 0.11;
        pointer.currentY += (pointer.y - pointer.currentY) * 0.11;
        currentProgress += (progress - currentProgress) * 0.1;
        scene.style.setProperty('--prism-shift', `${currentProgress * -85}px`);
        scene.style.setProperty('--prism-turn', `${currentProgress * -10}deg`);
        scene.style.setProperty('--prism-pointer-x', `${pointer.currentX * 6}deg`);
        scene.style.setProperty('--prism-pointer-y', `${pointer.currentY * -5}deg`);
        draw();
      }
      frame = window.requestAnimationFrame(render);
    }

    function syncMotion() {
      window.cancelAnimationFrame(frame);
      frame = 0;
      lastTime = 0;
      if (reduced.matches || !desktop.matches) {
        pointer.currentX = 0;
        pointer.currentY = 0;
        currentProgress = 0;
        for (const property of ['--prism-shift', '--prism-turn', '--prism-pointer-x', '--prism-pointer-y', '--prism-transfer']) scene.style.removeProperty(property);
        draw();
      } else if (animated()) frame = window.requestAnimationFrame(render);
    }

    function resize() {
      // Measure the layout surface, never its CSS-scaled fallback. The live
      // desktop aperture expands in ray space at this native Retina resolution.
      const width = Math.max(1, surface.clientWidth);
      const height = Math.max(1, surface.clientHeight);
      const deviceRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
      const pixelBudget = desktop.matches ? 4_500_000 : 2_400_000;
      const maxWidth = Math.min(desktop.matches ? 3072 : 2048, renderbufferLimit, viewportLimits[0]);
      const maxHeight = Math.min(renderbufferLimit, viewportLimits[1]);
      const ratio = Math.min(deviceRatio, maxWidth / width, maxHeight / height, Math.sqrt(pixelBudget / (width * height)));
      const drawingWidth = Math.max(1, Math.floor(width * ratio));
      const drawingHeight = Math.max(1, Math.floor(height * ratio));
      if (element.width !== drawingWidth || element.height !== drawingHeight) {
        element.width = drawingWidth;
        element.height = drawingHeight;
      }
      gl.viewport(0, 0, element.width, element.height);
      surface.dataset.renderDpr = ratio.toFixed(3);
      surface.dataset.bufferWidth = String(element.width);
      surface.dataset.bufferHeight = String(element.height);
      surface.dataset.bufferPixels = String(element.width * element.height);
      surface.dataset.pixelBudget = String(pixelBudget);
      draw();
      syncMotion();
    }

    function updateScroll() {
      scrollFrame = 0;
      if (heroScrubDriven || reduced.matches || !desktop.matches) return;
      progress = Math.max(0, Math.min(1, -scene.getBoundingClientRect().top / 640));
      scene.style.setProperty('--prism-transfer', progress.toFixed(3));
    }
    function queueScroll() { if (!heroScrubDriven && !scrollFrame && !document.hidden) scrollFrame = window.requestAnimationFrame(updateScroll); }
    function heroScroll(event) {
      const next = Number(event.detail?.progress);
      if (!Number.isFinite(next)) return;
      heroScrubDriven = true;
      progress = Math.max(0, Math.min(1, next));
      apertureScale = Math.max(1, Math.min(3, Number.parseFloat(scene.style.getPropertyValue('--hero-aperture-scale')) || 1));
      if (reduced.matches || !desktop.matches) return;
      scene.style.setProperty('--prism-transfer', progress.toFixed(3));
      if (!animated()) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastTime = 0;
        // A visitor pause exposes the static composition once, without replaying
        // the engine clock. An invisible scrubbed aperture needs no GPU draw.
        if (scene.dataset.heroPaused === 'true' && scene.dataset.heroScrubVisible !== 'false' && !document.hidden) {
          currentProgress = progress;
          draw();
        }
      } else if (!frame) {
        lastTime = 0;
        frame = window.requestAnimationFrame(render);
      }
    }
    function move(event) {
      if (event.pointerType !== 'mouse' || !desktop.matches || reduced.matches) return;
      pointer.x = Math.max(-1, Math.min(1, event.clientX / window.innerWidth * 2 - 1));
      pointer.y = Math.max(-1, Math.min(1, event.clientY / window.innerHeight * 2 - 1));
    }
    function leave() { pointer.x = 0; pointer.y = 0; }
    function contextLost(event) {
      event.preventDefault();
      lost = true;
      resources = null;
      surface.dataset.renderer = 'fallback';
      syncMotion();
    }
    function contextRestored() {
      lost = false;
      if (initialise()) resize();
    }

    if (!initialise()) return;
    image.onload = uploadLogo;
    image.src = PRODUCT_BRAND.symbol;
    const observer = typeof IntersectionObserver === 'function' ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      queueScroll();
      syncMotion();
    }) : null;
    observer?.observe(surface);
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
    resizeObserver?.observe(surface);
    scene.addEventListener('pointermove', move, { passive: true });
    scene.addEventListener('pointerleave', leave);
    scene.addEventListener('sos:hero-motion', syncMotion);
    scene.addEventListener('sos:hero-scroll', heroScroll);
    element.addEventListener('webglcontextlost', contextLost);
    element.addEventListener('webglcontextrestored', contextRestored);
    window.addEventListener('scroll', queueScroll, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', syncMotion);
    reduced.addEventListener('change', syncMotion);
    desktop.addEventListener('change', resize);
    resize();
    updateScroll();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(scrollFrame);
      observer?.disconnect();
      resizeObserver?.disconnect();
      image.onload = null;
      scene.removeEventListener('pointermove', move);
      scene.removeEventListener('pointerleave', leave);
      scene.removeEventListener('sos:hero-motion', syncMotion);
      scene.removeEventListener('sos:hero-scroll', heroScroll);
      element.removeEventListener('webglcontextlost', contextLost);
      element.removeEventListener('webglcontextrestored', contextRestored);
      window.removeEventListener('scroll', queueScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', syncMotion);
      reduced.removeEventListener('change', syncMotion);
      desktop.removeEventListener('change', resize);
      clearResources();
      for (const property of ['--prism-shift', '--prism-turn', '--prism-pointer-x', '--prism-pointer-y', '--prism-transfer']) scene.style.removeProperty(property);
    };
  }, []);

  return <div className="sos-prismatic-field" ref={field} aria-hidden="true">
    <div className="sos-optical-fallback">
      <i className="sos-reactor-orbit orbit-outer"/><i className="sos-reactor-orbit orbit-middle"/><i className="sos-reactor-orbit orbit-inner"/><i className="sos-reactor-core"/>
      <div className="sos-optical-floor"><img src={PRODUCT_BRAND.symbol} width="768" height="768" alt="" decoding="async" /></div>
    </div>
    <canvas ref={canvas} />
  </div>;
}
