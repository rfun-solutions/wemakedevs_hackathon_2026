import type { CaptionSegment, Engine, EngineCallbacks } from './types';
import { metric, span } from './telemetry';

/** Minimal shape of SpeechRecognition that we use (also what the unit-test fake implements). */
export interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onaudiostart: (() => void) | null;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}
export type RecognitionCtor = new () => RecognitionLike;

export const RESTART_BASE_MS = 250;
export const RESTART_MAX_MS = 4000;
export const MAX_EMPTY_RESTARTS = 5;

export interface WebSpeechOptions extends EngineCallbacks {
  Recognition: RecognitionCtor;
  lang?: string;
  /** Injectable clock and timers for unit tests. */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (h: unknown) => void;
}

export function getRecognitionCtor(
  g: Record<string, unknown> = globalThis as never,
): RecognitionCtor | undefined {
  return (g.SpeechRecognition ?? g.webkitSpeechRecognition) as RecognitionCtor | undefined;
}

/**
 * Browser speech API engine. Restarts recognition on `onend` while running (the iOS PWA session ended after ~12 s,
 * desktop Chrome after ~33 s): backoff 250 ms doubling to 4 s, reset after a result, give up after 5 consecutive
 * restarts with no `audiostart`. Latency to first word is measured from `audiostart`, not `start()`.
 */
export function createWebSpeechEngine(opts: WebSpeechOptions): Engine {
  const now = opts.now ?? (() => Date.now());
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const lang = opts.lang ?? globalThis.navigator?.language ?? 'en-US';

  let running = false;
  let rec: RecognitionLike | null = null;
  let timer: unknown;
  let delay = RESTART_BASE_MS;
  let emptyRestarts = 0;
  let run = 0;
  let audioStartAt: number | null = null;
  let firstWordDone = false;
  let lastInterimAt: number | null = null;
  const fatal = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

  function giveUp(reason: string): void {
    running = false;
    try {
      rec?.abort();
    } catch {
      /* ignore */
    }
    opts.onGiveUp?.(reason);
  }

  function begin(): void {
    if (!running) return;
    run += 1;
    const myRun = run;
    const r = new opts.Recognition();
    rec = r;
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    audioStartAt = null;
    firstWordDone = false;
    lastInterimAt = null;
    r.onaudiostart = () => {
      audioStartAt = now();
      emptyRestarts = 0;
    };
    r.onresult = (e) => {
      delay = RESTART_BASE_MS;
      const t = now();
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        const text = (res[0]?.transcript ?? '').trim();
        if (!text) continue;
        if (!firstWordDone && audioStartAt !== null) {
          firstWordDone = true;
          opts.onFirstWord?.(t - audioStartAt);
        }
        const seg: CaptionSegment = { id: `ws-${myRun}-${i}`, text, lang, final: res.isFinal };
        if (res.isFinal) {
          if (lastInterimAt !== null) opts.onLag?.(t - lastInterimAt);
          lastInterimAt = null;
        } else if (lastInterimAt === null) {
          lastInterimAt = t;
        }
        opts.onSegment(seg);
      }
    };
    r.onerror = (e) => {
      if (fatal.has(e.error)) giveUp(e.error);
    };
    r.onend = () => {
      if (!running || myRun !== run) return;
      if (emptyRestarts >= MAX_EMPTY_RESTARTS) {
        giveUp('no_audio');
        return;
      }
      emptyRestarts += 1;
      const wait = delay;
      delay = Math.min(RESTART_MAX_MS, delay * 2);
      timer = setTimer(() => {
        timer = undefined;
        if (!running) return;
        metric.restart('webspeech');
        span.restart();
        opts.onRestart?.();
        begin();
      }, wait);
    };
    try {
      r.start();
    } catch {
      giveUp('start_failed');
    }
  }

  return {
    id: 'webspeech',
    start() {
      running = true;
      delay = RESTART_BASE_MS;
      emptyRestarts = 0;
      begin();
      return Promise.resolve();
    },
    stop() {
      running = false;
      if (timer !== undefined) clearTimer(timer);
      timer = undefined;
      try {
        rec?.stop();
      } catch {
        /* ignore */
      }
      rec = null;
    },
  };
}
