import type { EngineId, Platform } from './types';

/**
 * Engine order per platform (FINAL after T4, 2026-11-08; desktop Chrome 157 + iPhone Safari):
 * - ios: ['webspeech'] only. Whisper crashed and reloaded the iOS tab on transcribe (per-tab memory limit), so it is
 *   never offered, never created as a worker and the model is never downloaded. Standalone (Home Screen PWA) behaves
 *   like Safari: the speech API works (verified 2026-11-08, iOS 18.7).
 * - desktop-chromium: ['whisper', 'webspeech']. Whisper decoded ~5 s chunks fine; the browser speech API skipped
 *   sentences on desktop Chrome (so it is the fallback, labelled "may miss words"), but worked decently on iPhone Safari.
 * - other: ['webspeech'] when SpeechRecognition exists, otherwise [] (typed-caption mode).
 */
export const ENGINE_ORDER: Record<Platform, readonly EngineId[]> = {
  ios: ['webspeech'],
  'desktop-chromium': ['whisper', 'webspeech'],
  other: ['webspeech'],
};

export interface Capabilities {
  worker: boolean;
  audioContext: boolean;
  getUserMedia: boolean;
  speechRecognition: boolean;
}

export function detectCapabilities(g: Record<string, unknown> = globalThis as never): Capabilities {
  const nav = g.navigator as { mediaDevices?: { getUserMedia?: unknown } } | undefined;
  return {
    worker: typeof g.Worker === 'function',
    audioContext:
      typeof g.AudioContext === 'function' || typeof g.webkitAudioContext === 'function',
    getUserMedia: typeof nav?.mediaDevices?.getUserMedia === 'function',
    speechRecognition:
      typeof g.SpeechRecognition === 'function' || typeof g.webkitSpeechRecognition === 'function',
  };
}

export function isCapable(engine: EngineId, platform: Platform, caps: Capabilities): boolean {
  if (!ENGINE_ORDER[platform].includes(engine)) return false;
  if (engine === 'whisper') return caps.worker && caps.audioContext && caps.getUserMedia;
  return caps.speechRecognition;
}

/** Capable engines in platform order. An empty list means typed-caption mode. */
export function availableEngines(platform: Platform, caps: Capabilities): EngineId[] {
  return ENGINE_ORDER[platform].filter((e) => isCapable(e, platform, caps));
}

/** Put `preferred` first when it is available (from the shared health hint); order otherwise unchanged. */
export function orderWithPreferred(available: EngineId[], preferred?: EngineId | null): EngineId[] {
  if (!preferred || !available.includes(preferred)) return available;
  return [preferred, ...available.filter((e) => e !== preferred)];
}
