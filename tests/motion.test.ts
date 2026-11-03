import { afterEach, describe, expect, it } from 'vitest';
import { motionHelp, requestMotionPermission } from '../src/signals/lib/motion';

const g = globalThis as unknown as { window?: unknown };
afterEach(() => {
  delete g.window;
});
const withApi = (requestPermission?: () => Promise<string>) => {
  g.window = { DeviceMotionEvent: requestPermission ? { requestPermission } : {} };
};

describe('requestMotionPermission', () => {
  it('is granted when the browser has no permission API (older Chrome, Firefox)', async () => {
    withApi();
    expect(await requestMotionPermission()).toEqual({ state: 'granted' });
  });
  it('passes on granted and denied answers (Safari, Chrome 151+)', async () => {
    withApi(async () => 'granted');
    expect(await requestMotionPermission()).toEqual({ state: 'granted' });
    withApi(async () => 'denied');
    expect(await requestMotionPermission()).toEqual({ state: 'denied' });
  });
  it('reports a rejected request as an error instead of a denial', async () => {
    withApi(async () => {
      throw new DOMException('requires user activation', 'NotAllowedError');
    });
    const r = await requestMotionPermission();
    expect(r.state).toBe('error');
    expect(r.state === 'error' && r.message).toContain('NotAllowedError');
  });
});

describe('motionHelp', () => {
  it('gives Chrome instructions on Android and Safari instructions on iPhone', () => {
    const pixel = 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Mobile Safari/537.36';
    const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1';
    expect(motionHelp(pixel)).toContain('Motion sensors');
    expect(motionHelp(pixel)).not.toContain('Safari');
    expect(motionHelp(iphone)).toContain('Safari');
    expect(motionHelp(iphone)).not.toContain('Android');
  });
});
