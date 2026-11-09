import { useEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { enqueueNote } from '../../lib/capture/queue';
import { startCaptions, type CaptionSession, type CaptionStatus } from '../../lib/speech';
import { MODEL_SIZE_MB } from '../../lib/speech/consent';
import type { CaptionSegment, EngineId } from '../../lib/speech/types';
import { span } from '../../lib/speech/telemetry';
import { markNoteBody, venueTime } from './mark';
import './captions.css';

interface Line {
  id: string;
  kind: 'caption' | 'typed' | 'mark';
  text: string;
  final: boolean;
}

const engineName = (e: EngineId) => t(`captions.engine.${e}`);

/** Message text and tone for a status event, or null when it only changes other state. */
export function statusMessage(s: CaptionStatus): { text: string; tone: 'info' | 'warning' } | null {
  switch (s.type) {
    case 'mic_denied':
      return { text: t('captions.mic.denied'), tone: 'warning' };
    case 'unsupported':
      return { text: t('captions.unsupported'), tone: 'warning' };
    case 'switched':
      return { text: t('captions.sli.switched', { engine: engineName(s.to) }), tone: 'info' };
    case 'slow_here':
      return { text: t('captions.sli.slow_here'), tone: 'warning' };
    case 'slow_everyone':
      return { text: t('captions.sli.slow_everyone'), tone: 'info' };
    case 'gave_up':
      return { text: t('captions.gave_up'), tone: 'warning' };
    case 'download_cancelled':
      return { text: t('captions.download.cancelled'), tone: 'info' };
    case 'downloading':
      return {
        text: t('captions.download.progress', {
          percent: s.total > 0 ? Math.min(100, Math.round((s.loaded / s.total) * 100)) : 0,
        }),
        tone: 'info',
      };
    case 'engine':
      return s.fallback
        ? { text: t('captions.engine.fallback', { engine: engineName(s.engine) }), tone: 'info' }
        : null;
  }
}

export function Captions() {
  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [engine, setEngine] = useState<EngineId | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'info' | 'warning' } | null>(null);
  const [typedMode, setTypedMode] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [consentAsk, setConsentAsk] = useState<((ok: boolean) => void) | null>(null);
  const session = useRef<CaptionSession | null>(null);
  const abort = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const typedInput = useRef<HTMLInputElement>(null);

  useEffect(() => () => session.current?.stop(), []);
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (consentAsk && !d.open) d.showModal?.();
    if (!consentAsk && d.open) d.close();
  }, [consentAsk]);

  const onSegment = (seg: CaptionSegment) =>
    setLines((prev) => {
      const i = prev.findIndex((l) => l.id === seg.id);
      const next: Line = { id: seg.id, kind: 'caption', text: seg.text, final: seg.final };
      if (i === -1) return [...prev, next];
      const copy = prev.slice();
      copy[i] = next;
      return copy;
    });

  const onStatus = (s: CaptionStatus) => {
    if (s.type === 'engine') setEngine(s.engine);
    if (s.type === 'switched') setEngine(s.to);
    if (s.type === 'downloading') setDownloading(true);
    if (s.type === 'engine' || s.type === 'download_cancelled' || s.type === 'gave_up')
      setDownloading(false);
    if (s.type === 'unsupported') setTypedMode(true);
    const m = statusMessage(s);
    if (m) setMessage(m);
    else if (s.type === 'engine') setMessage(null);
  };

  async function turnOn() {
    setStarting(true);
    setMessage(null);
    abort.current = new AbortController();
    const s = await startCaptions(onSegment, {
      onStatus,
      signal: abort.current.signal,
      requestConsent: () => new Promise<boolean>((resolve) => setConsentAsk(() => resolve)),
    });
    setStarting(false);
    setDownloading(false);
    session.current = s;
    setOn(s.supported);
  }

  function turnOff() {
    session.current?.stop();
    session.current = null;
    setOn(false);
    setEngine(null);
  }

  function answerConsent(ok: boolean) {
    consentAsk?.(ok);
    setConsentAsk(null);
  }

  const lastCaptionText = () => [...lines].reverse().find((l) => l.kind !== 'mark')?.text;

  async function saveLine(line: Line) {
    try {
      await enqueueNote({ body: line.text, source: 'caption' });
      span.highlightToNote({ chars: line.text.length });
      setMessage({ text: t('captions.save.done'), tone: 'info' });
    } catch {
      setMessage({ text: t('captions.save.failed'), tone: 'warning' });
    }
  }

  async function insertMark() {
    const time = venueTime();
    const body = markNoteBody(time, lastCaptionText());
    setLines((prev) => [
      ...prev,
      {
        id: `mark-${Date.now()}-${prev.length}`,
        kind: 'mark',
        text: t('captions.mark.line', { time }),
        final: true,
      },
    ]);
    try {
      await enqueueNote({ body, source: 'caption' });
      setMessage({ text: t('captions.mark.done', { time }), tone: 'info' });
    } catch {
      setMessage({ text: t('captions.mark.failed', { time }), tone: 'warning' });
    }
  }

  function addTyped(e: Event) {
    e.preventDefault();
    const el = typedInput.current;
    const text = el?.value.trim();
    if (!el || !text) return;
    setLines((prev) => [
      ...prev,
      { id: `typed-${Date.now()}-${prev.length}`, kind: 'typed', text, final: true },
    ]);
    el.value = '';
  }

  return (
    <section class="captions" aria-labelledby="captions-title">
      <h2 id="captions-title">{t('captions.title')}</h2>
      <p class="captions-hint">{t('captions.near_live')}</p>
      {!on && !starting && <p class="captions-hint">{t('captions.mic.intro')}</p>}
      <div class="captions-actions">
        {on ? (
          <button type="button" class="btn" onClick={turnOff}>
            {t('captions.stop')}
          </button>
        ) : (
          <button type="button" class="btn" disabled={starting} onClick={() => void turnOn()}>
            {t('captions.start')}
          </button>
        )}
        <button type="button" class="btn captions-btn-secondary" onClick={() => void insertMark()}>
          {t('captions.mark.button')}
        </button>
        {downloading && (
          <button
            type="button"
            class="btn captions-btn-secondary"
            onClick={() => abort.current?.abort()}
          >
            {t('captions.download.cancel')}
          </button>
        )}
      </div>
      {engine && (
        <p class="captions-engine">
          {t('captions.engine.label', { engine: engineName(engine) })}
          {engine === 'webspeech' ? ` ${t('captions.engine.maymiss')}` : ''}
        </p>
      )}
      <p class="captions-message" role="status" aria-live="polite" data-tone={message?.tone}>
        {message?.text ?? ''}
      </p>
      {/* >> e-captions-translation-translate */}
      <div class="captions-log" role="log" aria-live="polite" aria-label={t('captions.log.label')}>
        {lines.length === 0 && <p class="captions-empty">{t('captions.empty')}</p>}
        <ul class="captions-lines">
          {lines.map((l) => (
            <li key={l.id} class="captions-line" data-kind={l.kind} data-final={String(l.final)}>
              <span>{l.text}</span>
              {l.kind !== 'mark' && (
                <button
                  type="button"
                  class="btn captions-btn-secondary"
                  aria-label={t('captions.save.aria', { text: l.text })}
                  onClick={() => void saveLine(l)}
                >
                  {t('captions.save')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      {typedMode && (
        <form class="captions-typed" onSubmit={addTyped}>
          <label for="captions-typed-input">{t('captions.typed.label')}</label>
          <input id="captions-typed-input" ref={typedInput} type="text" autocomplete="off" />
          <button type="submit" class="btn">
            {t('captions.typed.add')}
          </button>
        </form>
      )}
      <dialog
        ref={dialog}
        class="captions-dialog"
        aria-labelledby="captions-consent-title"
        onCancel={(e) => {
          e.preventDefault();
          answerConsent(false);
        }}
      >
        <h3 id="captions-consent-title">{t('captions.consent.title')}</h3>
        <p>{t('captions.consent.body', { size: MODEL_SIZE_MB })}</p>
        <div class="captions-actions">
          <button type="button" class="btn" onClick={() => answerConsent(true)}>
            {t('captions.consent.download')}
          </button>
          <button
            type="button"
            class="btn captions-btn-secondary"
            onClick={() => answerConsent(false)}
          >
            {t('captions.consent.decline')}
          </button>
        </div>
      </dialog>
    </section>
  );
}
