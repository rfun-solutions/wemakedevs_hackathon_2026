import { describe, expect, it } from 'vitest';
import {
  ENGINE_ORDER,
  availableEngines,
  detectCapabilities,
  isCapable,
  orderWithPreferred,
} from './engine';
import { detectPlatform } from './platform';

const ALL = { worker: true, audioContext: true, getUserMedia: true, speechRecognition: true };

describe('ENGINE_ORDER', () => {
  it('has the three platform orders', () => {
    expect(ENGINE_ORDER.ios).toEqual(['webspeech']);
    expect(ENGINE_ORDER['desktop-chromium']).toEqual(['whisper', 'webspeech']);
    expect(ENGINE_ORDER.other).toEqual(['webspeech']);
  });
  it('standalone iOS yields only webspeech', () => {
    const p = detectPlatform({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X)',
      standalone: true,
    });
    expect(availableEngines(p.platform, ALL)).toEqual(['webspeech']);
  });
});

describe('availableEngines', () => {
  it('desktop Chromium: whisper then webspeech; falls back when the worker is missing', () => {
    expect(availableEngines('desktop-chromium', ALL)).toEqual(['whisper', 'webspeech']);
    expect(availableEngines('desktop-chromium', { ...ALL, worker: false })).toEqual(['webspeech']);
  });
  it('no SpeechRecognition on other means typed mode (empty list)', () => {
    expect(availableEngines('other', { ...ALL, speechRecognition: false })).toEqual([]);
  });
  it('iOS never lists whisper even if every capability is present', () => {
    expect(isCapable('whisper', 'ios', ALL)).toBe(false);
  });
  it('detectCapabilities reads the globals', () => {
    expect(
      detectCapabilities({ Worker() {}, navigator: { mediaDevices: { getUserMedia() {} } } }),
    ).toEqual({
      worker: true,
      audioContext: false,
      getUserMedia: true,
      speechRecognition: false,
    });
  });
});

describe('orderWithPreferred', () => {
  it('moves a capable preferred engine first, ignores an unavailable one', () => {
    expect(orderWithPreferred(['whisper', 'webspeech'], 'webspeech')).toEqual([
      'webspeech',
      'whisper',
    ]);
    expect(orderWithPreferred(['webspeech'], 'whisper')).toEqual(['webspeech']);
    expect(orderWithPreferred(['whisper', 'webspeech'], null)).toEqual(['whisper', 'webspeech']);
  });
});
