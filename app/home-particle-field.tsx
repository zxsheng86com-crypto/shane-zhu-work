'use client';

import { useEffect, useRef } from 'react';

const LAYERS = 9;

const vertexShader = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPosition;
layout(location=1) in float aLayer;
layout(location=2) in float aSize;
layout(location=3) in float aAlpha;
layout(location=4) in float aSeed;
uniform vec2 uPointer;
uniform vec2 uFit;
uniform float uTime;
uniform float uDpr;
uniform float uDepth;
uniform float uTwinkle;
uniform float uYLift;
out float vAlpha;
void main() {
  float depth = (aLayer - 0.5) * 0.7 * uDepth;
  float yaw = uPointer.x * (0.2 + abs(depth) * 0.12) * uDepth;
  float pitch = uPointer.y * (0.17 + abs(depth) * 0.1) * uDepth;
  vec2 p = aPosition * uFit * 1.3;
  float x = p.x * cos(yaw) + depth * sin(yaw);
  float z = -p.x * sin(yaw) + depth * cos(yaw);
  float y = p.y * cos(pitch) - z * sin(pitch);
  z = p.y * sin(pitch) + z * cos(pitch);
  float perspective = 1.0 / max(0.62, 1.0 - z * 0.22);
  p = vec2(x, y) * mix(1.0, perspective, uDepth);
  p.y += uYLift;
  float driftSpeed = 0.22 + fract(aSeed * 3.17) * 0.45;
  float drift = sin(uTime * driftSpeed + aLayer * 6.28318 + aSeed * 4.2) * (0.0012 + fract(aSeed * 9.1) * 0.0024);
  p += vec2(drift, -drift * 0.7);
  gl_Position = vec4(p, 0.0, 1.0);
  gl_PointSize = clamp(aSize * uDpr * (1.0 + depth * 0.12), 1.0, 6.0);
  // Desynced twinkle: auto-play life on every device; mobile leans on this instead of 3D.
  float twinkleSpeed = 0.55 + fract(aSeed * 5.738) * 2.35;
  float twinklePhase = aSeed * 6.28318;
  float w1 = 0.5 + 0.5 * sin(uTime * twinkleSpeed + twinklePhase);
  float w2 = 0.5 + 0.5 * sin(uTime * (twinkleSpeed * 1.67 + 0.35) + twinklePhase * 1.9);
  float pulse = mix(w1, pow(w1, 2.4), 0.55) * 0.72 + w2 * 0.28;
  float range = 0.14 * uTwinkle;
  float twinkle = (1.0 - range * 0.85) + range * pulse;
  vAlpha = min(1.0, aAlpha * 1.4) * twinkle;
}`;

const fragmentShader = `#version 300 es
precision mediump float;
in float vAlpha;
out vec4 outColor;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5);
  float edge = max(q.x, q.y);
  if (edge > 0.5) discard;
  float soft = 1.0 - smoothstep(0.32, 0.5, edge);
  outColor = vec4(vec3(0.94), vAlpha * soft);
}`;

function compileShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function HomeParticleField({ onReady }: { onReady?: () => void }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const field = fieldRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!field || !image || !canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isMobile = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    const saveData = Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);
    // Same volumetric particle field on mobile and desktop. Desktop adds pointer tilt;
    // mobile keeps full depth + density (no mouse), optional light idle sway so layers read.
    const preferStatic = reducedMotion.matches || saveData;
    const pointerInteractive = !isMobile && !preferStatic;
    const depthAmount = preferStatic ? 0 : 1;
    const twinkleAmount = preferStatic ? 0 : 1;
    const sampleCols = isMobile ? 280 : window.matchMedia('(max-width: 1199px)').matches ? 280 : 460;

    let gl: WebGL2RenderingContext | null = null;
    let frame = 0;
    let visible = false;
    let destroyed = false;
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let fitX = 1;
    let fitY = 1;
    let dpr = 1;
    let count = 0;
    let buffer: WebGLBuffer | null = null;
    let vao: WebGLVertexArrayObject | null = null;
    let program: WebGLProgram | null = null;
    let positionLocation: WebGLUniformLocation | null = null;
    let fitLocation: WebGLUniformLocation | null = null;
    let timeLocation: WebGLUniformLocation | null = null;
    let dprLocation: WebGLUniformLocation | null = null;
    let depthLocation: WebGLUniformLocation | null = null;
    let twinkleLocation: WebGLUniformLocation | null = null;
    let yLiftLocation: WebGLUniformLocation | null = null;
    // Desktop keeps the lifted galaxy; mobile centers in the first screen.
    const yLift = isMobile ? 0.04 : 0.28;
    let startTime = 0;
    let lastTime = 0;
    let initTimer = 0;
    // Declared before draw — gyro is optional and must never block particle init.
    let gyroActive = false;
    let orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;
    let motionHandler: ((event: DeviceMotionEvent) => void) | null = null;
    let gyroArm: ((event?: Event) => void) | null = null;
    let baseGamma: number | null = null;
    let baseBeta: number | null = null;
    let gotOrientation = false;

    const resize = () => {
      if (!gl) return;
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
      // Cover (like pinnacl): fill the field, crop overflow — do NOT letterbox/shrink with width.
      const imageAspect = image.naturalWidth / image.naturalHeight;
      const fieldAspect = rect.width / rect.height;
      if (fieldAspect > imageAspect) {
        fitX = 1;
        fitY = fieldAspect / imageAspect;
      } else {
        fitX = imageAspect / fieldAspect;
        fitY = 1;
      }
      draw(performance.now());
    };

    const draw = (time: number) => {
      if (!gl || !program || !count) return;
      if (!startTime) startTime = time;
      const delta = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60;
      lastTime = time;
      if (pointerInteractive) {
        const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-12 * delta);
        pointerX += (targetX - pointerX) * ease;
        pointerY += (targetY - pointerY) * ease;
      } else if (isMobile && depthAmount > 0 && !reducedMotion.matches) {
        if (!gyroActive) {
          // Soft idle sway until gyro permission / first orientation event.
          const t = (time - startTime) / 1000;
          targetX = Math.sin(t * 0.35) * 0.22;
          targetY = Math.cos(t * 0.28) * 0.14;
        }
        // Snappier follow when gyro is driving; softer while idle.
        const ease = 1 - Math.exp(-(gyroActive ? 10 : 6) * delta);
        pointerX += (targetX - pointerX) * ease;
        pointerY += (targetY - pointerY) * ease;
      }
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.uniform2f(positionLocation, pointerX, pointerY);
      gl.uniform2f(fitLocation, fitX, fitY);
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0 : (time - startTime) / 1000);
      gl.uniform1f(dprLocation, dpr);
      gl.uniform1f(depthLocation, depthAmount);
      gl.uniform1f(twinkleLocation, twinkleAmount);
      gl.uniform1f(yLiftLocation, yLift);
      gl.drawArrays(gl.POINTS, 0, count);
    };

    const animate = (time: number) => {
      draw(time);
      if (visible && !reducedMotion.matches) frame = requestAnimationFrame(animate);
      else frame = 0;
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!pointerInteractive || reducedMotion.matches) return;
      const rect = field.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
        targetX = 0;
        targetY = 0;
        return;
      }
      targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      targetY = 1 - ((event.clientY - rect.top) / rect.height) * 2;
      if (visible && !frame) frame = requestAnimationFrame(animate);
    };
    const onBlur = () => {
      targetX = 0;
      targetY = 0;
    };

    // Mobile-only gyro → same ±1 pointer space as desktop mouse. Desktop never enters this path.
    // Use the same isMobile gate as the particle field (already true on phones).
    const useGyro = isMobile && !preferStatic;
    const DeviceOrientation = typeof DeviceOrientationEvent !== 'undefined' ? DeviceOrientationEvent : null;
    const DeviceMotion = typeof DeviceMotionEvent !== 'undefined' ? DeviceMotionEvent : null;
    const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

    const applyGyroTargets = (x: number, y: number) => {
      targetX = clamp(x, -1, 1);
      targetY = clamp(y, -1, 1);
      gyroActive = true;
      if (visible && !frame) frame = requestAnimationFrame(animate);
    };

    const onDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (destroyed || !useGyro || reducedMotion.matches || depthAmount <= 0) return;
      const gamma = typeof event.gamma === 'number' ? event.gamma : null;
      const beta = typeof event.beta === 'number' ? event.beta : null;
      if (gamma === null && beta === null) return;
      // Calibrate against the first reading so tilt-from-rest is obvious.
      if (gamma !== null && baseGamma === null) baseGamma = gamma;
      if (beta !== null && baseBeta === null) baseBeta = beta;
      const dg = gamma !== null ? gamma - (baseGamma ?? 0) : 0;
      const db = beta !== null ? beta - (baseBeta ?? 0) : 0;
      gotOrientation = true;
      // Stronger than mouse range so phone tilt reads clearly.
      applyGyroTargets(dg / 16, db / 20);
    };

    const onDeviceMotion = (event: DeviceMotionEvent) => {
      if (destroyed || !useGyro || reducedMotion.matches || depthAmount <= 0) return;
      // Only when orientation events never arrive (common on some WebViews / HTTP).
      if (gotOrientation) return;
      const acc = event.accelerationIncludingGravity;
      if (!acc || typeof acc.x !== 'number') return;
      const ax = acc.x;
      const az = typeof acc.z === 'number' ? acc.z : 0;
      applyGyroTargets(ax / 5, -az / 5);
    };

    const attachGyro = () => {
      if (destroyed || !useGyro) return;
      try {
        if (!orientationHandler && DeviceOrientation) {
          orientationHandler = onDeviceOrientation;
          window.addEventListener('deviceorientation', orientationHandler, { passive: true });
          // Some Android builds prefer the absolute variant.
          window.addEventListener('deviceorientationabsolute' as 'deviceorientation', orientationHandler, { passive: true });
        }
        if (!motionHandler && DeviceMotion) {
          motionHandler = onDeviceMotion;
          window.addEventListener('devicemotion', motionHandler, { passive: true });
        }
      } catch {
        /* ignore */
      }
    };

    // Test/prod probe: lets automation inject orientation and read follow state.
    (window as Window & { __cfGyro?: unknown }).__cfGyro = {
      getState: () => ({
        useGyro,
        gyroActive,
        attached: Boolean(orientationHandler),
        targetX,
        targetY,
        pointerX,
        pointerY,
        baseGamma,
        baseBeta,
      }),
      attach: attachGyro,
      /** Simulate phone tilt. First call calibrates; later calls should move targets. */
      injectOrientation: (gamma: number, beta: number) => {
        attachGyro();
        onDeviceOrientation({ gamma, beta, alpha: 0 } as DeviceOrientationEvent);
      },
      injectMotion: (x: number, z: number) => {
        attachGyro();
        onDeviceMotion({
          accelerationIncludingGravity: { x, y: 0, z },
        } as DeviceMotionEvent);
      },
    };

    const requestGyroPermission = () => {
      if (destroyed || !useGyro) return;
      const tasks: Array<Promise<string>> = [];
      try {
        const DOE = DeviceOrientation as (typeof DeviceOrientationEvent & {
          requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
        }) | null;
        if (DOE && typeof DOE.requestPermission === 'function') {
          tasks.push(DOE.requestPermission().catch(() => 'denied'));
        }
        const DME = DeviceMotion as (typeof DeviceMotionEvent & {
          requestPermission?: () => Promise<'granted' | 'denied' | 'default'>;
        }) | null;
        if (DME && typeof DME.requestPermission === 'function') {
          tasks.push(DME.requestPermission().catch(() => 'denied'));
        }
      } catch {
        /* ignore */
      }
      if (tasks.length) {
        Promise.all(tasks).then((states) => {
          if (!destroyed && states.some((state) => state === 'granted')) attachGyro();
          // Even if denied/failed, try attach — some browsers still emit motion on HTTP.
          else if (!destroyed) attachGyro();
        });
      } else {
        attachGyro();
      }
    };

    let readyNotified = false;
    let readyWatchdog = 0;
    const reportReady = () => {
      if (readyNotified) return;
      readyNotified = true;
      window.clearTimeout(readyWatchdog);
      onReady?.();
    };
    const showFallback = () => {
      field.classList.add('is-fallback');
      reportReady();
    };
    readyWatchdog = window.setTimeout(showFallback, isMobile ? 2500 : 5000);

    const initialize = () => {
      try {
        if (destroyed || !image.naturalWidth) return;
        if (preferStatic) return showFallback();

        gl = canvas.getContext('webgl2', { alpha: true, antialias: false, depth: false, powerPreference: 'low-power' });
        if (!gl) return showFallback();

        const vertex = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
        const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
        if (!vertex || !fragment) return showFallback();
        program = gl.createProgram();
        if (!program) return showFallback();
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          gl.deleteProgram(program);
          program = null;
          return showFallback();
        }

        const cols = sampleCols;
        const rows = Math.max(1, Math.round(cols * image.naturalHeight / image.naturalWidth));
        const sample = document.createElement('canvas');
        sample.width = cols * 2;
        sample.height = rows * 2;
        const context = sample.getContext('2d', { willReadFrequently: true });
        if (!context) return showFallback();
        context.drawImage(image, 0, 0, sample.width, sample.height);
        const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
        const luminance = new Float32Array(cols * rows);
        let maxLuminance = 0;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            let max = 0;
            for (let sy = 0; sy < 2; sy++) {
              for (let sx = 0; sx < 2; sx++) {
                const offset = ((y * 2 + sy) * sample.width + x * 2 + sx) * 4;
                const light = (pixels[offset] * 299 + pixels[offset + 1] * 587 + pixels[offset + 2] * 114) / 1000 / 255;
                if (light > max) max = light;
              }
            }
            luminance[y * cols + x] = max;
            if (max > maxLuminance) maxLuminance = max;
          }
        }

        let seed = 20260926;
        const random = () => {
          seed |= 0;
          seed = seed + 0x6d2b79f5 | 0;
          let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
          value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
          return ((value ^ value >>> 14) >>> 0) / 4294967296;
        };
        const points: number[] = [];
        const normalize = maxLuminance > 0 ? 0.98 / maxLuminance : 1;
        const MID_LAYER_MIN = 3;
        const MID_LAYER_MAX = 5;
        // Mobile: slightly denser keep threshold so the lighter grid still reads as a galaxy.
        const keepFloor = 0.022;
        const keepCeil = 0.072;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const light = Math.min(1, luminance[y * cols + x] * normalize);
            const keep = (light - keepFloor) / (keepCeil - keepFloor);
            const size = 0.75 + 1.6 * Math.pow(light, 0.8);
            const alpha = 0.24 + 0.62 * Math.pow(light, 0.9);

            if (keep > 0 && (keep >= 1 || bayer[(x & 3) + ((y & 3) << 2)] / 16 < keep)) {
              const imageDepth = (1 - light) * 0.72 + (y / rows) * 0.12 + random() * 0.16;
              const layer = Math.min(LAYERS - 1, Math.floor(imageDepth * LAYERS));
              const px = ((x + 0.5 + (random() - 0.5) * 0.25) / cols) * 2 - 1;
              const py = 1 - ((y + 0.5 + (random() - 0.5) * 0.25) / rows) * 2;
              points.push(px, py, (layer + 0.5) / LAYERS, size, alpha, random());
            }

            // Core mass extras — same on mobile; scale count slightly for perf.
            if (light < 0.15) continue;
            const core = Math.pow((light - 0.15) / 0.85, 1.28);
            let expectedMid = core * (isMobile ? 2.4 : 3.15);
            if (light > 0.52) expectedMid += (light - 0.52) * (isMobile ? 2.4 : 3.1);
            const whole = Math.floor(expectedMid);
            const extras = whole + (random() < expectedMid - whole ? 1 : 0);
            for (let n = 0; n < extras; n++) {
              const midLayer = MID_LAYER_MIN + Math.floor(random() * (MID_LAYER_MAX - MID_LAYER_MIN + 1));
              const jitter = 0.4 + n * 0.08;
              const px = ((x + 0.5 + (random() - 0.5) * jitter) / cols) * 2 - 1;
              const py = 1 - ((y + 0.5 + (random() - 0.5) * jitter) / rows) * 2;
              points.push(px, py, (midLayer + 0.5) / LAYERS, size, alpha, random());
            }
          }
        }
        count = points.length / 6;
        if (!count) return showFallback();

        vao = gl.createVertexArray();
        buffer = gl.createBuffer();
        if (!vao || !buffer) return showFallback();
        gl.bindVertexArray(vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
        const stride = 6 * Float32Array.BYTES_PER_ELEMENT;
        [2, 1, 1, 1, 1].forEach((size, index) => {
          gl!.enableVertexAttribArray(index);
          gl!.vertexAttribPointer(index, size, gl!.FLOAT, false, stride, [0, 2, 3, 4, 5][index] * Float32Array.BYTES_PER_ELEMENT);
        });
        gl.bindVertexArray(null);
        gl.useProgram(program);
        gl.bindVertexArray(vao);
        positionLocation = gl.getUniformLocation(program, 'uPointer');
        fitLocation = gl.getUniformLocation(program, 'uFit');
        timeLocation = gl.getUniformLocation(program, 'uTime');
        dprLocation = gl.getUniformLocation(program, 'uDpr');
        depthLocation = gl.getUniformLocation(program, 'uDepth');
        twinkleLocation = gl.getUniformLocation(program, 'uTwinkle');
        yLiftLocation = gl.getUniformLocation(program, 'uYLift');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.clearColor(0, 0, 0, 0);
        resize();
        field.classList.add('is-ready');
        reportReady();
        if (visible) frame = requestAnimationFrame(animate);
      } catch {
        showFallback();
      }
    };

    const onMotionPreferenceChange = () => {
      onBlur();
      if (reducedMotion.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        draw(0);
      } else if (visible && !frame) frame = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !frame && !reducedMotion.matches) frame = requestAnimationFrame(animate);
      else if (!visible) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
    });
    const resizeObserver = new ResizeObserver(resize);
    observer.observe(field);
    resizeObserver.observe(field);
    if (pointerInteractive) {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('blur', onBlur);
    }
    reducedMotion.addEventListener('change', onMotionPreferenceChange);

    // Defer past first paint / loader so mobile sampling never blocks intro.
    const scheduleInit = () => {
      if (destroyed) return;
      if (preferStatic) {
        showFallback();
        return;
      }
      // Yield to the browser so Lottie/paint can run before the heavy sample pass.
      initTimer = window.setTimeout(() => {
        if (!destroyed) initialize();
      }, isMobile ? 280 : 0);
    };
    const onImageError = () => {
      if (!destroyed) showFallback();
    };
    if (preferStatic) {
      showFallback();
    } else if (image.complete && image.naturalWidth) {
      scheduleInit();
    } else {
      image.addEventListener('load', scheduleInit, { once: true });
      image.addEventListener('error', onImageError, { once: true });
    }

    // Arm gyro AFTER particle init is scheduled — never block onReady / intro.
    if (useGyro) {
      try {
        const needsGesture = Boolean(
          (DeviceOrientation as { requestPermission?: unknown } | null)?.requestPermission
          || (DeviceMotion as { requestPermission?: unknown } | null)?.requestPermission,
        );
        if (needsGesture) {
          // iOS: permission must run inside a user gesture. Arm touch + click early.
          gyroArm = () => {
            if (!gyroArm) return;
            const arm = gyroArm;
            gyroArm = null;
            window.removeEventListener('pointerdown', arm, true);
            window.removeEventListener('touchstart', arm, true);
            window.removeEventListener('click', arm, true);
            requestGyroPermission();
          };
          window.addEventListener('pointerdown', gyroArm, { capture: true, passive: true });
          window.addEventListener('touchstart', gyroArm, { capture: true, passive: true });
          window.addEventListener('click', gyroArm, { capture: true, passive: true });
        } else {
          // Android / others: listen immediately (no prompt).
          window.setTimeout(() => {
            if (!destroyed) attachGyro();
          }, 0);
        }
      } catch {
        /* ignore — particles still run with idle sway */
      }
    }

    return () => {
      destroyed = true;
      delete (window as Window & { __cfGyro?: unknown }).__cfGyro;
      window.clearTimeout(readyWatchdog);
      window.clearTimeout(initTimer);
      cancelAnimationFrame(frame);
      image.removeEventListener('load', scheduleInit);
      image.removeEventListener('error', onImageError);
      observer.disconnect();
      resizeObserver.disconnect();
      if (pointerInteractive) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('blur', onBlur);
      }
      if (gyroArm) {
        window.removeEventListener('pointerdown', gyroArm, true);
        window.removeEventListener('touchstart', gyroArm, true);
        window.removeEventListener('click', gyroArm, true);
      }
      if (orientationHandler) {
        window.removeEventListener('deviceorientation', orientationHandler);
        window.removeEventListener('deviceorientationabsolute' as 'deviceorientation', orientationHandler);
      }
      if (motionHandler) window.removeEventListener('devicemotion', motionHandler);
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      if (gl && vao) gl.deleteVertexArray(vao);
      if (gl && buffer) gl.deleteBuffer(buffer);
      if (gl && program) gl.deleteProgram(program);
    };
  }, []);

  return <div ref={fieldRef} className="cf-hero-particles">
    <picture>
      {/* Mobile-first: default src is the light asset so phones never pull the 3.7MB desktop PNG. */}
      <source media="(min-width: 801px)" srcSet="/media/home-galaxy.png" />
      {/* eslint-disable-next-line @next/next/no-img-element -- need direct img for WebGL sampling */}
      <img
        ref={imageRef}
        src="/media/home-galaxy-mobile.jpg"
        alt=""
        draggable={false}
        decoding="async"
      />
    </picture>
    <canvas ref={canvasRef} aria-hidden="true" />
  </div>;
}
