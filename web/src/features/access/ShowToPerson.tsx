import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { dirFor, type CardLang } from './card-text';
import { largestFit } from './fit-text';
import { speak, speechSupported, stopSpeaking } from './speech';
import './access-cards.css';

export interface ShowToPersonProps {
  /** The phrase (or badge lines joined with newlines). */
  text: string;
  /** Card language: tags the text with `lang` and sets direction. */
  lang: CardLang;
  onClose: () => void;
  /** Element to focus on close. Safari does not focus a button on tap, so the opener passes itself. */
  returnTo?: HTMLElement | null;
}

const MIN_PX = 16;

/** Full-screen, fit-text display of a phrase for another person. Uses the --show-fg/--show-bg pair. */
export function ShowToPerson({ text, lang, onClose, returnTo }: ShowToPersonProps) {
  const root = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLParagraphElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [size, setSize] = useState(48);

  // Remember what opened us so focus returns to it, and move focus into the dialog.
  useEffect(() => {
    const opener = returnTo ?? (document.activeElement as HTMLElement | null);
    closeBtn.current?.focus();
    return () => {
      stopSpeaking();
      opener?.focus?.();
    };
  }, []);

  // Keep the screen awake when the browser supports it (progressive enhancement).
  useEffect(() => {
    let lock: WakeLockSentinel | undefined;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: WakeLock };
    nav.wakeLock
      ?.request('screen')
      .then((l) => {
        if (cancelled) void l.release();
        else lock = l;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release().catch(() => undefined);
    };
  }, []);

  // Fit text: largest size at which the text fits the box without scrolling.
  useLayoutEffect(() => {
    const fit = () => {
      const b = box.current;
      const p = body.current;
      if (!b || !p) return;
      const max = Math.max(MIN_PX, Math.min(b.clientHeight, b.clientWidth * 0.6));
      const best = largestFit(MIN_PX, max, (px) => {
        p.style.fontSize = `${px}px`;
        return p.scrollHeight <= b.clientHeight && p.scrollWidth <= b.clientWidth;
      });
      p.style.fontSize = `${best}px`;
      setSize(best);
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [text, lang]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    // Keep focus inside the dialog.
    const items = root.current?.querySelectorAll<HTMLElement>('button');
    if (!items?.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const canSpeak = speechSupported();
  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- key handling for Escape and focus trap on the dialog
    <div
      ref={root}
      class="show"
      role="dialog"
      aria-modal="true"
      aria-label={t('access.show.dialog')}
      data-show
      onKeyDown={onKeyDown}
    >
      <div class="show-bar">
        <button ref={closeBtn} type="button" class="show-btn" onClick={onClose}>
          {t('access.show.close')}
        </button>
        {canSpeak && (
          <button type="button" class="show-btn" onClick={() => speak(text, lang)}>
            {t('access.show.speak')}
          </button>
        )}
      </div>
      <div ref={box} class="show-text" data-size={size}>
        <p ref={body} lang={lang} dir={dirFor(lang)}>
          {text}
        </p>
      </div>
    </div>
  );
}
