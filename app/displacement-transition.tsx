'use client';

import { useEffect, useRef } from 'react';

type Props = {
  sources: string[];
  active: number;
  onSettled: (index: number) => void;
};

const TRANSITION_DURATION = 1800;
const INTENSITY = 0.3;

const vertexShader = `
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = position * .5 + .5;
    gl_Position = vec4(position, 0., 1.);
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D currentImage;
  uniform sampler2D nextImage;
  uniform float dispFactor;
  uniform vec2 currentRepeat;
  uniform vec2 currentOffset;
  uniform vec2 nextRepeat;
  uniform vec2 nextOffset;
  #define texCurrent(uv) texture2D(currentImage, (uv) * currentRepeat + currentOffset)
  #define texNext(uv) texture2D(nextImage, (uv) * nextRepeat + nextOffset)
  void main() {
    vec2 uv = vUv;
    vec4 _currentImage;
    vec4 _nextImage;
    float intensity = ${INTENSITY};
    vec4 orig1 = texCurrent(uv);
    vec4 orig2 = texNext(uv);
    _currentImage = texCurrent(vec2(uv.x, uv.y + dispFactor * (orig2.r * intensity)));
    _nextImage = texNext(vec2(uv.x, uv.y + (1.0 - dispFactor) * (orig1.r * intensity)));
    vec4 finalTexture = mix(_currentImage, _nextImage, dispFactor);
    gl_FragColor = finalTexture;
  }
`;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(src: string) {
  const cached = imageCache.get(src);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
  imageCache.set(src, pending);
  return pending;
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
}

function createProgram(gl: WebGLRenderingContext) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexShader);
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, fragmentShader);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  return gl.getProgramParameter(program, gl.LINK_STATUS) ? program : null;
}

function coverFit(planeWidth: number, planeHeight: number, imageWidth: number, imageHeight: number) {
  const width = Math.max(1, planeWidth);
  const height = Math.max(1, planeHeight);
  const scale = Math.max(width / Math.max(1, imageWidth), height / Math.max(1, imageHeight));
  const renderedWidth = imageWidth * scale;
  const renderedHeight = imageHeight * scale;
  return {
    repeatX: width / renderedWidth,
    repeatY: height / renderedHeight,
    offsetX: (1 - width / renderedWidth) / 2,
    offsetY: (1 - height / renderedHeight) / 2,
  };
}

function easeInOutQuad(progress: number) {
  return progress < .5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
}

export function DisplacementTransition({ sources, active, onSettled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const goToRef = useRef<((index: number) => void) | undefined>(undefined);
  const activeRef = useRef(active);
  const onSettledRef = useRef(onSettled);

  useEffect(() => { onSettledRef.current = onSettled; }, [onSettled]);
  useEffect(() => {
    activeRef.current = active;
    goToRef.current?.(active);
  }, [active]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true, antialias: false, preserveDrawingBuffer: true });
    if (!gl) return;

    const program = createProgram(gl);
    const buffer = gl.createBuffer();
    if (!program || !buffer) return;

    const position = gl.getAttribLocation(program, 'position');
    const currentImage = gl.getUniformLocation(program, 'currentImage');
    const nextImage = gl.getUniformLocation(program, 'nextImage');
    const dispFactor = gl.getUniformLocation(program, 'dispFactor');
    const currentRepeat = gl.getUniformLocation(program, 'currentRepeat');
    const currentOffset = gl.getUniformLocation(program, 'currentOffset');
    const nextRepeat = gl.getUniformLocation(program, 'nextRepeat');
    const nextOffset = gl.getUniformLocation(program, 'nextOffset');

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(currentImage, 0);
    gl.uniform1i(nextImage, 1);

    let textures: WebGLTexture[] = [];
    let images: HTMLImageElement[] = [];
    let current = 0;
    let animating = false;
    let frame = 0;
    let cancelled = false;

    const setCover = (name: 'current' | 'next', index: number) => {
      const image = images[index];
      if (!image) return;
      const rect = canvas.getBoundingClientRect();
      const { repeatX, repeatY, offsetX, offsetY } = coverFit(rect.width, rect.height, image.naturalWidth, image.naturalHeight);
      gl.uniform2f(name === 'current' ? currentRepeat : nextRepeat, repeatX, repeatY);
      gl.uniform2f(name === 'current' ? currentOffset : nextOffset, offsetX, offsetY);
    };

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(rect.width * pixelRatio));
      const height = Math.max(1, Math.round(rect.height * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        setCover('current', current);
        setCover('next', (current + 1) % Math.max(1, textures.length));
      }
      gl.viewport(0, 0, width, height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    const bind = (unit: number, texture: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, texture);
    };

    const startTransition = (target: number) => {
      if (!textures.length || animating || target === current) return;
      animating = true;
      const from = current;
      bind(0, textures[from]);
      setCover('current', from);
      bind(1, textures[target]);
      setCover('next', target);
      gl.uniform1f(dispFactor, 0);
      render();

      const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : TRANSITION_DURATION;
      const startedAt = performance.now();
      const step = (now: number) => {
        const progress = duration ? Math.min((now - startedAt) / duration, 1) : 1;
        gl.uniform1f(dispFactor, easeInOutQuad(progress));
        render();
        if (progress < 1) {
          frame = window.requestAnimationFrame(step);
          return;
        }
        current = target;
        bind(0, textures[current]);
        setCover('current', current);
        bind(1, textures[(current + 1) % textures.length]);
        setCover('next', (current + 1) % textures.length);
        gl.uniform1f(dispFactor, 0);
        render();
        animating = false;
        onSettledRef.current(current);
      };
      step(startedAt);
    };

    goToRef.current = startTransition;
    const resize = () => render();
    window.addEventListener('resize', resize);

    Promise.all(sources.map(loadImage)).then((loadedImages) => {
      if (cancelled) return;
      images = loadedImages;
      textures = loadedImages.map((image) => {
        const texture = gl.createTexture();
        if (!texture) throw new Error('Unable to create carousel texture.');
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        return texture;
      });
      bind(0, textures[current]);
      bind(1, textures[(current + 1) % textures.length]);
      setCover('current', current);
      setCover('next', (current + 1) % textures.length);
      gl.uniform1f(dispFactor, 0);
      render();
      startTransition(activeRef.current);
    }).catch(() => onSettledRef.current(activeRef.current));

    return () => {
      cancelled = true;
      goToRef.current = undefined;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      textures.forEach((texture) => gl.deleteTexture(texture));
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [sources]);

  return <canvas ref={canvasRef} className="noravale-home-displacement is-ready" aria-hidden="true" />;
}
