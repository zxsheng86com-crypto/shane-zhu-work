import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../app/work/[slug]/viewport-video.tsx', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const effects = [];
const observers = [];
let activeVideo;

function makeVideo() {
  const events = new Map();
  return {
    autoplay: false,
    controls: false,
    currentTime: 4,
    defaultMuted: false,
    muted: false,
    paused: true,
    preload: 'metadata',
    playAttempts: 0,
    pauseAttempts: 0,
    play() { this.playAttempts++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauseAttempts++; this.paused = true; },
    addEventListener(name, callback) { events.set(name, callback); },
    removeEventListener(name) { events.delete(name); },
    events,
  };
}

function entry(visibleHeight, height = 500, top = 250) {
  return {
    isIntersecting: visibleHeight > 0,
    intersectionRect: { height: visibleHeight },
    boundingClientRect: { height, top },
    rootBounds: { height: 1000 },
  };
}

const exported = {};
vm.runInNewContext(code, {
  exports: exported,
  require: name => name === 'react' ? {
    useRef: () => ({ current: activeVideo }),
    useEffect: callback => effects.push(callback),
  } : { jsx: (_tag, props) => props, jsxs: (_tag, props) => props },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  document: { hidden: false, addEventListener() {}, removeEventListener() {} },
  IntersectionObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
    disconnect() {}
  },
  innerHeight: 1000,
  setTimeout,
  clearTimeout,
});

const firstVideo = makeVideo();
activeVideo = firstVideo;
const rendered = exported.ViewportVideo({ src: '/media/dji-romo/02.mp4' });
assert.equal(rendered.autoPlay, undefined, 'Video must not autoplay before entering the viewport');
assert.equal(rendered.playsInline, true);
assert.equal(rendered.muted, true);
const firstCleanup = effects.shift()();

const secondVideo = makeVideo();
activeVideo = secondVideo;
exported.ViewportVideo({ src: '/media/dji-romo/02.mp4' });
const secondCleanup = effects.shift()();

assert.equal(firstVideo.paused, true, 'Below-viewport video stays on its static frame');
assert.equal(secondVideo.paused, true, 'Below-viewport video stays on its static frame');
observers[0].callback([entry(1)], observers[0]);
assert.equal(firstVideo.preload, 'auto', 'Near-viewport video is preloaded before playback');
observers[1].callback([entry(500)]);
observers[3].callback([entry(500)]);
assert.equal(firstVideo.paused, false, 'Visible video plays automatically');
assert.equal(secondVideo.paused, false, 'Side-by-side visible videos can play together');

firstVideo.currentTime = 7.25;
observers[1].callback([entry(100)]);
assert.equal(firstVideo.paused, true, 'Video pauses after leaving the active viewport area');
assert.equal(firstVideo.currentTime, 7.25, 'Viewport pause preserves the current frame');
assert.equal(secondVideo.paused, false, 'The other visible video keeps playing');

firstCleanup();
secondCleanup();
assert.equal(firstVideo.events.size, 0);
assert.equal(secondVideo.events.size, 0);
console.log('PASS: viewport playback, parallel layout videos, frame-preserving pause, preload');
