import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.7 Mobile/15E148 Safari/604.1';
const IPHONE_CHROME =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/157.0 Mobile/15E148 Safari/604.1';
const IPAD_AS_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';
const MAC_CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
const WIN_EDGE =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36 Edg/157.0.0.0';
const FIREFOX =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0';
const MAC_SAFARI = IPAD_AS_MAC;
const PIXEL =
  'Mozilla/5.0 (Linux; Android 15; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36';

describe('detectPlatform', () => {
  it('iPhone Safari and iPhone Chrome are ios', () => {
    expect(detectPlatform({ userAgent: IPHONE }).platform).toBe('ios');
    expect(detectPlatform({ userAgent: IPHONE_CHROME }).platform).toBe('ios');
  });
  it('iPadOS reporting as a touch Mac is ios, a real Mac Safari is not', () => {
    const ipad = detectPlatform({
      userAgent: IPAD_AS_MAC,
      platform: 'MacIntel',
      maxTouchPoints: 5,
    });
    expect(ipad).toMatchObject({ platform: 'ios', deviceClass: 'ios' });
    const mac = detectPlatform({ userAgent: MAC_SAFARI, platform: 'MacIntel', maxTouchPoints: 0 });
    expect(mac.platform).toBe('other');
  });
  it('desktop Chrome and Edge are desktop-chromium', () => {
    expect(
      detectPlatform({ userAgent: MAC_CHROME, platform: 'MacIntel', maxTouchPoints: 0 }),
    ).toMatchObject({ platform: 'desktop-chromium', deviceClass: 'desktop' });
    expect(detectPlatform({ userAgent: WIN_EDGE }).platform).toBe('desktop-chromium');
  });
  it('Firefox is other, Android is other with deviceClass android', () => {
    expect(detectPlatform({ userAgent: FIREFOX }).platform).toBe('other');
    expect(detectPlatform({ userAgent: PIXEL })).toMatchObject({
      platform: 'other',
      deviceClass: 'android',
    });
  });
  it('standalone iOS is still ios', () => {
    expect(detectPlatform({ userAgent: IPHONE, standalone: true })).toMatchObject({
      platform: 'ios',
      standalone: true,
    });
    expect(detectPlatform({ userAgent: IPHONE }, true).standalone).toBe(true);
  });
});
