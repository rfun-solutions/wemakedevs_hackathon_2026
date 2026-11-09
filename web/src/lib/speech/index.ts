import {
  availableEngines,
  detectCapabilities,
  orderWithPreferred,
  type Capabilities,
} from './engine';
import { hasWhisperConsent, setWhisperConsent } from './consent';
import { fetchCaptionsHealth, type CaptionsHealth } from './health';
import { detectCurrentPlatform, type PlatformInfo } from './platform';
import { createSliReporter, type SliReporter } from './reporter';
import { createSliMonitor } from './sli';
import { metric } from './telemetry';
import type { CaptionSegment, Engine, EngineCallbacks, EngineId, SpeechSession } from './types';
import { createWebSpeechEngine, getRecognitionCtor } from './webspeech';
import { createWhisperEngine, type WhisperWorkerLike } from './whisper';

export type { CaptionSegment, SpeechSession, EngineId } from './types';

/** Things the Captions screen shows or announces. */
export type CaptionStatus =
  | { type: 'unsupported' }
  | { type: 'mic_denied' }
  | { type: 'engine'; engine: EngineId; fallback: boolean }
  | { type: 'switched'; from: EngineId; to: EngineId }
  | { type: 'slow_here' }
  | { type: 'slow_everyone' }
  | { type: 'downloading'; loaded: number; total: number }
  | { type: 'download_cancelled' }
  | { type: 'gave_up'; reason: string };

export interface CaptionOptions {
  /** Called before the first Whisper download; resolve true for "Download now". Absent means no consent. */
  requestConsent?: () => Promise<boolean>;
  onStatus?: (s: CaptionStatus) => void;
  /** Abort a model download (Cancel button). */
  signal?: AbortSignal;
}

/** Everything the session needs from the browser; replaceable in tests. */
export interface SessionDeps {
  platform: PlatformInfo;
  caps: Capabilities;
  requestMic: () => Promise<boolean>;
  fetchHealth: (deviceClass: PlatformInfo['deviceClass']) => Promise<CaptionsHealth>;
  makeWebSpeech: (cb: EngineCallbacks) => Engine;
  /** Never called on iOS (not in the platform's engine list). */
  makeWhisper: (
    cb: EngineCallbacks,
    hooks: { signal?: AbortSignal; onProgress: (l: number, t: number) => void },
  ) => Engine;
  hasConsent: () => boolean;
  saveConsent: () => void;
  reporter: SliReporter;
}

export async function requestMicPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export function defaultDeps(): SessionDeps {
  const platform = detectCurrentPlatform();
  return {
    platform,
    caps: detectCapabilities(),
    requestMic: requestMicPermission,
    fetchHealth: (dc) => fetchCaptionsHealth(dc),
    makeWebSpeech: (cb) => {
      const Recognition = getRecognitionCtor();
      if (!Recognition) throw new Error('no SpeechRecognition');
      return createWebSpeechEngine({ ...cb, Recognition });
    },
    makeWhisper: (cb, hooks) =>
      createWhisperEngine({
        ...cb,
        signal: hooks.signal,
        onDownloadProgress: hooks.onProgress,
        createWorker: () =>
          new Worker(new URL('./whisper.worker.ts', import.meta.url), {
            type: 'module',
          }) as unknown as WhisperWorkerLike,
      }),
    hasConsent: () => hasWhisperConsent(),
    saveConsent: () => setWhisperConsent(),
    reporter: createSliReporter({ deviceClass: platform.deviceClass }),
  };
}

export interface CaptionSession extends SpeechSession {
  engine?: EngineId;
}

/** Captions session: engine pick (platform order + shared health), consent, mic, SLI switch, reporting. */
export async function startCaptionsWith(
  deps: SessionDeps,
  onSegment: (segment: CaptionSegment) => void,
  options: CaptionOptions = {},
): Promise<CaptionSession> {
  const status = options.onStatus ?? (() => undefined);
  const { platform, caps, reporter } = deps;
  const available = availableEngines(platform.platform, caps);
  const none: CaptionSession = { supported: false, stop() {} };
  if (available.length === 0) {
    status({ type: 'unsupported' });
    return none;
  }
  // Early mic permission on the explicit tap; the wait is not part of any latency.
  if (!(await deps.requestMic())) {
    status({ type: 'mic_denied' });
    return none;
  }
  const health = await deps.fetchHealth(platform.deviceClass);
  if (health.lagging) status({ type: 'slow_everyone' });
  const order = orderWithPreferred(available, health.fasterEngine);

  let stopped = false;
  let current: Engine | null = null;
  /** Engine being started; its callbacks are accepted while the previous engine keeps captioning. */
  let pending: EngineId | null = null;
  let consentDeclined = false;
  let lastPercentStep = -1;
  const session: CaptionSession = {
    supported: true,
    stop() {
      stopped = true;
      current?.stop();
      current = null;
      reporter.stop();
    },
  };

  const sli = createSliMonitor(() =>
    order.some(
      (e) => e !== session.engine && !(e === 'whisper' && consentDeclined && !deps.hasConsent()),
    ),
  );

  const accepts = (id: EngineId) => session.engine === id || pending === id;

  function callbacks(id: EngineId): EngineCallbacks {
    return {
      onSegment: (seg) => {
        if (!stopped && accepts(id)) onSegment(seg);
      },
      onLag: (ms) => {
        if (stopped || !accepts(id) || session.engine !== id) return;
        metric.lag(ms, id);
        reporter.add(id, ms);
        const action = sli.record(ms);
        if (action === 'message') status({ type: 'slow_here' });
        else if (action === 'switch') void switchEngine('slow');
      },
      onGiveUp: (reason) => {
        if (!stopped && accepts(id)) status({ type: 'gave_up', reason });
      },
    };
  }

  /** Try to start `id`; false on consent decline, load failure or cancel (caller falls back). */
  async function tryStart(id: EngineId): Promise<boolean> {
    let engine: Engine;
    try {
      if (id === 'whisper') {
        if (!deps.hasConsent()) {
          if (consentDeclined) return false; // never re-ask mid-talk after a "no"
          const ok = (await options.requestConsent?.()) === true;
          if (!ok) {
            consentDeclined = true;
            return false;
          }
          deps.saveConsent();
        }
        lastPercentStep = -1;
        engine = deps.makeWhisper(callbacks(id), {
          signal: options.signal,
          // Throttled to 10% steps so the polite live region is not flooded.
          onProgress: (loaded, total) => {
            const step = total > 0 ? Math.min(10, Math.floor((loaded / total) * 10)) : 0;
            if (step === lastPercentStep) return;
            lastPercentStep = step;
            status({ type: 'downloading', loaded, total });
          },
        });
      } else {
        engine = deps.makeWebSpeech(callbacks(id));
      }
      pending = id;
      await engine.start();
    } catch {
      pending = null;
      if (options.signal?.aborted) status({ type: 'download_cancelled' });
      return false;
    }
    pending = null;
    if (stopped) {
      engine.stop();
      return true;
    }
    current = engine;
    session.engine = id;
    return true;
  }

  async function switchEngine(reason: 'slow'): Promise<void> {
    const from = session.engine!;
    const prev = current;
    for (const next of order.filter((e) => e !== from)) {
      reporter.flush();
      if (await tryStart(next)) {
        prev?.stop();
        metric.fallback(reason, from, next);
        status({ type: 'switched', from, to: next });
        return;
      }
    }
    if (!stopped) status({ type: 'slow_here' });
  }

  reporter.start();
  for (const [i, id] of order.entries()) {
    if (await tryStart(id)) {
      if (i > 0) metric.fallback('unavailable', order[0]!, id);
      status({ type: 'engine', engine: id, fallback: i > 0 });
      return session;
    }
  }
  reporter.stop();
  status({ type: 'unsupported' });
  return none;
}

export function startCaptions(
  onSegment: (segment: CaptionSegment) => void,
  options?: CaptionOptions,
): Promise<CaptionSession> {
  return startCaptionsWith(defaultDeps(), onSegment, options);
}

/**
 * Dictation for the note field: the browser speech API only (the keyboard dictation on iOS also works).
 * `onText` receives each finished phrase.
 */
export function startDictation(onText: (text: string) => void): Promise<SpeechSession> {
  const Recognition = getRecognitionCtor();
  if (!Recognition) return Promise.resolve({ supported: false, stop() {} });
  const engine = createWebSpeechEngine({
    Recognition,
    onSegment: (seg) => {
      if (seg.final) onText(seg.text);
    },
  });
  return engine.start().then(
    () => ({ supported: true, engine: 'webspeech' as const, stop: () => engine.stop() }),
    () => ({ supported: false, stop() {} }),
  );
}
