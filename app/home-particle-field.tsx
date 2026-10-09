'use client';

import { useEffect, useRef, useState } from 'react';

const LAYERS = 9;
const MOTION_PREFERENCE_KEY = 'home-motion-enabled';

type MotionControlState = 'hidden' | 'enable' | 'retry';

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
uniform float uGyro;
uniform float uTwinkle;
uniform float uYLift;
out float vAlpha;
void main() {
  float depth = (aLayer - 0.5) * 0.7 * uDepth;
  vec2 p = aPosition * uFit * 1.3;
  p += vec2(uPointer.x, -uPointer.y) * depth * 0.34 * uGyro;
  float rotation = mix(1.0, 0.3, uGyro);
  float yaw = uPointer.x * (0.2 + abs(depth) * 0.12) * uDepth * rotation;
  float pitch = uPointer.y * (0.17 + abs(depth) * 0.1) * uDepth * rotation;
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
  float twinkleSpeed = (0.55 + fract(aSeed * 5.738) * 2.35) * (1.0 + 0.55 * clamp(uTwinkle - 1.0, 0.0, 2.0));
  float twinklePhase = aSeed * 6.28318;
  float w1 = 0.5 + 0.5 * sin(uTime * twinkleSpeed + twinklePhase);
  float w2 = 0.5 + 0.5 * sin(uTime * (twinkleSpeed * 1.67 + 0.35) + twinklePhase * 1.9);
  float pulse = mix(w1, pow(w1, 2.4), 0.55) * 0.72 + w2 * 0.28;
  // Stronger alpha swing when uTwinkle > 1 (mobile life without gyro).
  float range = 0.14 * uTwinkle;
  float twinkle = (1.0 - range * 0.92) + range * pulse;
  vAlpha = min(1.0, aAlpha * (1.4 + 0.25 * clamp(uTwinkle - 1.0, 0.0, 2.0))) * twinkle;
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

export function HomeParticleField({
  onReady,
  onProgress,
}: {
  onReady?: () => void;
  /** 0–100 while galaxy download + particle boot run. */
  onProgress?: (value: number) => void;
}) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [motionControl, setMotionControl] = useState<MotionControlState>('hidden');
  const startMotionRef = useRef<(() => Promise<void>) | null>(null);
  const onReadyRef = useRef(onReady);
  const onProgressRef = useRef(onProgress);
  onReadyRef.current = onReady;
  onProgressRef.current = onProgress;

  useEffect(() => {
    const field = fieldRef.current;
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!field || !image || !canvas) return;

    const resetUrl = new URL(window.location.href);
    if (resetUrl.searchParams.has('reset-motion')) {
      try {
        window.localStorage.removeItem(MOTION_PREFERENCE_KEY);
      } catch {
        // The reset still removes the query marker when storage is unavailable.
      }
      resetUrl.searchParams.delete('reset-motion');
      window.history.replaceState(window.history.state, '', resetUrl);
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const isMobile = window.matchMedia('(max-width: 800px), (pointer: coarse)').matches;
    // ponytail: never treat saveData as "show static photo" — keep trying WebGL
    const quiet = reducedMotion.matches;
    let pointerInteractive = !isMobile && !quiet;
    const depthAmount = quiet ? 0 : 1;
    // Mobile: stronger twinkle replaces removed gyro life.
    const twinkleAmount = quiet ? 0 : isMobile ? 2.8 : 1;
    const sampleCols = isMobile ? 280 : window.matchMedia('(max-width: 1199px)').matches ? 280 : 460;
    const galaxyUrl = isMobile ? '/media/home-galaxy-mobile.jpg' : '/media/home-galaxy.jpg';

    let gl: WebGL2RenderingContext | null = null;
    let frame = 0;
    let motionSetupFrame = 0;
    let visible = false;
    let destroyed = false;
    let blobUrl: string | undefined;
    let lastProgress = -1;
    const reportProgress = (value: number) => {
      const next = Math.max(0, Math.min(100, Math.round(value)));
      if (next <= lastProgress) return;
      lastProgress = next;
      onProgressRef.current?.(next);
    };
    reportProgress(2);
    let pointerX = 0;
    let pointerY = 0;
    let targetX = 0;
    let targetY = 0;
    let motionListening = false;
    let motionConfirmed = false;
    let motionTimeout = 0;
    let baselineBeta: number | null = null;
    let baselineGamma: number | null = null;
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
    let gyroLocation: WebGLUniformLocation | null = null;
    let twinkleLocation: WebGLUniformLocation | null = null;
    let yLiftLocation: WebGLUniformLocation | null = null;
    const yLift = isMobile ? 0.04 : 0.28;
    let startTime = 0;
    let lastTime = 0;
    
    const resize = () => {
      if (!gl) return;
      const rect = field.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
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
        const ease = reducedMotion.matches ? 1 : 1 - Math.exp(-(isMobile ? 18 : 12) * delta);
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
      gl.uniform1f(gyroLocation, isMobile ? 1 : 0);
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
    const onVisibilityChange = () => {
      if (document.hidden) {
        baselineBeta = null;
        baselineGamma = null;
        onBlur();
      }
    };

    const orientationConstructor = window.DeviceOrientationEvent as (typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied' | 'prompt'>;
    }) | undefined;
    const hasMotionPermissionApi = typeof orientationConstructor?.requestPermission === 'function';
    const onDeviceOrientation = (event: DeviceOrientationEvent) => {
      if (!visible || document.hidden || reducedMotion.matches || event.beta === null || event.gamma === null) return;
      if (baselineBeta === null || baselineGamma === null) {
        baselineBeta = event.beta;
        baselineGamma = event.gamma;
      }
      const clamp = (value: number) => Math.max(-1, Math.min(1, value));
      targetX = clamp((event.gamma - baselineGamma) / 32);
      targetY = clamp((event.beta - baselineBeta) / 32);
      pointerInteractive = true;
      if (visible && !frame) frame = requestAnimationFrame(animate);
      if (motionListening && !motionConfirmed) {
        motionConfirmed = true;
        window.clearTimeout(motionTimeout);
        try {
          window.localStorage.setItem(MOTION_PREFERENCE_KEY, '1');
        } catch {
          // Motion still works when browser storage is unavailable.
        }
        setMotionControl('hidden');
      }
    };
    const stopMotion = () => {
      if (motionListening) window.removeEventListener('deviceorientation', onDeviceOrientation);
      motionListening = false;
      motionConfirmed = false;
      window.clearTimeout(motionTimeout);
      pointerInteractive = !isMobile && !reducedMotion.matches;
      baselineBeta = null;
      baselineGamma = null;
      onBlur();
      window.removeEventListener('blur', onBlur);
      try {
        window.localStorage.removeItem(MOTION_PREFERENCE_KEY);
      } catch {
        // Motion can still be disabled when browser storage is unavailable.
      }
      setMotionControl(isMobile && !reducedMotion.matches ? 'enable' : 'hidden');
      if (visible && !frame && !reducedMotion.matches) frame = requestAnimationFrame(animate);
    };
    const listenForMotion = () => {
      if (motionListening || !orientationConstructor || reducedMotion.matches) return;
      baselineBeta = null;
      baselineGamma = null;
      motionListening = true;
      motionConfirmed = false;
      window.addEventListener('deviceorientation', onDeviceOrientation, { passive: true });
      window.addEventListener('blur', onBlur);
      setMotionControl('hidden');
      motionTimeout = window.setTimeout(() => {
        if (!motionListening || motionConfirmed) return;
        window.removeEventListener('deviceorientation', onDeviceOrientation);
        window.removeEventListener('blur', onBlur);
        motionListening = false;
        setMotionControl('retry');
      }, 1800);
    };
    const startMotion = async () => {
      if (!orientationConstructor || reducedMotion.matches) return;
      setMotionControl('hidden');
      try {
        if (hasMotionPermissionApi) {
          const permission = await orientationConstructor.requestPermission!();
          if (permission !== 'granted') {
            setMotionControl('retry');
            return;
          }
        }
        listenForMotion();
        setMotionControl('hidden');
      } catch {
        setMotionControl('retry');
      }
    };
    startMotionRef.current = startMotion;

    let readyNotified = false;
    let readyWatchdog = 0;
    const reportReady = () => {
      if (readyNotified) return;
      readyNotified = true;
      window.clearTimeout(readyWatchdog);
      reportProgress(100);
      onReadyRef.current?.();
    };
    // Never reveal the sampling photo — black hero if WebGL stalls.
    const showFallback = () => {
      field.classList.add('is-fallback');
      field.classList.remove('is-ready');
      reportReady();
    };
    readyWatchdog = window.setTimeout(showFallback, isMobile ? 8000 : 12000);
    const yieldFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const initialize = async () => {
      try {
        if (destroyed || !image.naturalWidth) return;
        reportProgress(48);

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

        reportProgress(55);
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
          if (y % 28 === 0) {
            reportProgress(55 + (y / rows) * 10);
            await yieldFrame();
            if (destroyed) return;
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

            if (light < 0.15) continue;
            const core = Math.pow((light - 0.15) / 0.85, 1.28);
            let expectedMid = core * (isMobile ? 3.5 : 3.15);
            if (light > 0.52) expectedMid += (light - 0.52) * (isMobile ? 4 : 3.1);
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
          if (y % 20 === 0) {
            reportProgress(65 + (y / rows) * 25);
            await yieldFrame();
            if (destroyed) return;
          }
        }
        reportProgress(92);
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
        gyroLocation = gl.getUniformLocation(program, 'uGyro');
        twinkleLocation = gl.getUniformLocation(program, 'uTwinkle');
        yLiftLocation = gl.getUniformLocation(program, 'uYLift');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.clearColor(0, 0, 0, 0);
        resize();
        reportProgress(98);
        field.classList.remove('is-fallback');
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
        stopMotion();
        setMotionControl('hidden');
        cancelAnimationFrame(frame);
        frame = 0;
        draw(0);
      } else if (visible && !frame) frame = requestAnimationFrame(animate);
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) onBlur();
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
    document.addEventListener('visibilitychange', onVisibilityChange);
    if (isMobile && !quiet && orientationConstructor) {
      let motionPreferenceEnabled = false;
      try {
        motionPreferenceEnabled = window.localStorage.getItem(MOTION_PREFERENCE_KEY) === '1';
      } catch {
        // Treat unavailable storage as an unconfigured preference.
      }
      motionSetupFrame = requestAnimationFrame(() => {
        if (motionPreferenceEnabled) listenForMotion();
        else setMotionControl('enable');
      });
    }

    const boot = async () => {
      try {
        reportProgress(4);
        const response = await fetch(galaxyUrl, { cache: 'force-cache' });
        if (!response.ok) throw new Error('galaxy fetch failed');
        const total = Number(response.headers.get('content-length') || 0);
        const reader = response.body?.getReader();
        let blob: Blob;
        if (reader) {
          const chunks: Uint8Array[] = [];
          let received = 0;
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              received += value.byteLength;
              if (total > 0) reportProgress(4 + (received / total) * 40);
              else reportProgress(Math.min(42, 4 + chunks.length * 2));
            }
            if (destroyed) return;
          }
          blob = new Blob(chunks as BlobPart[]);
        } else {
          blob = await response.blob();
        }
        if (destroyed) return;
        reportProgress(46);
        blobUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('galaxy decode failed'));
          image.src = blobUrl!;
        });
        if (destroyed) return;
        reportProgress(48);
        await initialize();
      } catch {
        if (!destroyed) showFallback();
      }
    };
    void boot();

    return () => {
      destroyed = true;
      window.clearTimeout(readyWatchdog);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(motionSetupFrame);
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      image.onload = null;
      image.onerror = null;
      observer.disconnect();
      resizeObserver.disconnect();
      if (pointerInteractive) {
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('blur', onBlur);
      }
      if (motionListening) window.removeEventListener('deviceorientation', onDeviceOrientation);
      window.removeEventListener('blur', onBlur);
      window.clearTimeout(motionTimeout);
      startMotionRef.current = null;
      reducedMotion.removeEventListener('change', onMotionPreferenceChange);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (gl && vao) gl.deleteVertexArray(vao);
      if (gl && buffer) gl.deleteBuffer(buffer);
      if (gl && program) gl.deleteProgram(program);
    };
  }, []);

  return <div ref={fieldRef} className="cf-hero-particles">
    {/* eslint-disable-next-line @next/next/no-img-element -- sampling source for WebGL only; never shown */}
    <img ref={imageRef} alt="" draggable={false} decoding="async" aria-hidden="true" />
    <canvas ref={canvasRef} aria-hidden="true" />
    <button
      className="cf-motion-orb"
      type="button"
      aria-label={motionControl === 'retry' ? 'Retry device motion / 重试陀螺仪视差' : 'Enable device motion / 开启陀螺仪视差'}
      disabled={motionControl === 'hidden'}
      hidden={motionControl === 'hidden'}
      onClick={() => void startMotionRef.current?.()}
    />
  </div>;
}
