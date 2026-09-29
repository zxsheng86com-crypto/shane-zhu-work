/**
 * Gyro follow self-check (no playwright required).
 * Run against a page that already exposes window.__cfGyro (mobile viewport).
 *
 * Or use Cursor browser CDP on http://localhost:3000 with width≤800:
 *   injectOrientation(0,45) then injectOrientation(32,70) → |Δtarget| should be large.
 */
export function assertGyroFollow(api) {
  if (!api?.injectOrientation || !api?.getState) {
    throw new Error('__cfGyro probe missing');
  }
  const state0 = api.getState();
  if (!state0.useGyro) throw new Error('useGyro=false — not on mobile particle path');

  api.injectOrientation(0, 45);
  const rest = api.getState();
  api.injectOrientation(32, 70);
  const tilted = api.getState();
  const dx = Math.abs(tilted.targetX - rest.targetX);
  const dy = Math.abs(tilted.targetY - rest.targetY);
  if (!tilted.gyroActive || (dx < 0.4 && dy < 0.3)) {
    throw new Error(`gyro did not follow tilt dx=${dx} dy=${dy}`);
  }
  return { ok: true, dx, dy, tilted };
}
