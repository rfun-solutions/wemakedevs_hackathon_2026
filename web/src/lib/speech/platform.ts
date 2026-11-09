import type { DeviceClass, Platform } from './types';

export interface PlatformInfo {
  platform: Platform;
  deviceClass: DeviceClass;
  /** Home Screen PWA. Standalone iOS uses the same engine path as Safari (T4, 2026-11-08). */
  standalone: boolean;
}

export interface NavLike {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  standalone?: boolean;
}

/** Any WebKit on iOS/iPadOS, including iPadOS 13+ which reports itself as a Mac with touch. */
export function isIos(nav: NavLike): boolean {
  if (/iPhone|iPad|iPod/.test(nav.userAgent)) return true;
  return (
    (nav.platform === 'MacIntel' || /Macintosh/.test(nav.userAgent)) &&
    (nav.maxTouchPoints ?? 0) > 1
  );
}

export function detectPlatform(
  nav: NavLike = globalThis.navigator,
  standaloneMedia = false,
): PlatformInfo {
  const standalone = nav.standalone === true || standaloneMedia;
  if (isIos(nav)) return { platform: 'ios', deviceClass: 'ios', standalone };
  const ua = nav.userAgent;
  if (/Android/.test(ua)) return { platform: 'other', deviceClass: 'android', standalone };
  const chromium = /(Chrome|Chromium|Edg)\//.test(ua) && !/OPR\/|Firefox\//.test(ua);
  return {
    platform: chromium ? 'desktop-chromium' : 'other',
    deviceClass: 'desktop',
    standalone,
  };
}

/** Browser-side detection using the real navigator and the standalone display mode. */
export function detectCurrentPlatform(): PlatformInfo {
  let media = false;
  try {
    media = globalThis.matchMedia?.('(display-mode: standalone)').matches === true;
  } catch {
    /* ignore */
  }
  return detectPlatform(globalThis.navigator, media);
}
