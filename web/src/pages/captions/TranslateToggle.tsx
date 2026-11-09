import { useEffect, useRef, useState } from 'preact/hooks';
import { getLang, t, useLang } from '../../i18n';
import {
  createChromeTranslate,
  createTranslateHandler,
  type TranslateHandler,
} from '../../lib/translate';

interface CaptionLine {
  id: string;
  kind: string;
  text: string;
  final: boolean;
}
type Result = { text: string } | { unavailable: true } | null;

/** Translate toggle for the Captions screen. Originals stay in the caption log; translations are listed here. */
export function TranslateToggle({ lines }: { lines: CaptionLine[] }) {
  const lang = useLang();
  const [on, setOn] = useState(false);
  const [results, setResults] = useState<Record<string, Result>>({});
  const handler = useRef<TranslateHandler | null>(null);
  const asked = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  async function toggle() {
    if (on) {
      handler.current = null;
      setOn(false);
      return;
    }
    // The click is the user gesture Chrome's Translator.create() needs.
    const target = getLang();
    const chrome = await createChromeTranslate(target);
    handler.current = createTranslateHandler(target, chrome);
    asked.current = new Set();
    setResults({});
    setOn(true);
  }

  useEffect(() => {
    const h = handler.current;
    if (!on || !h) return;
    for (const l of lines) {
      if (l.kind === 'mark' || !l.final || asked.current.has(l.id)) continue;
      asked.current.add(l.id);
      setResults((r) => ({ ...r, [l.id]: null }));
      h.translate(l.id, l.text).then(
        (text) => mounted.current && setResults((r) => ({ ...r, [l.id]: { text } })),
        () => mounted.current && setResults((r) => ({ ...r, [l.id]: { unavailable: true } })),
      );
    }
  }, [lines, on]);

  const shown = lines.filter((l) => l.id in results);
  return (
    <div class="captions-translate" data-lang={lang}>
      <button
        type="button"
        class="btn captions-btn-secondary"
        aria-pressed={on}
        onClick={() => void toggle()}
      >
        {on ? t('translate.toggle.off') : t('translate.toggle.on')}
      </button>
      {on && (
        <div role="region" aria-live="polite" aria-label={t('translate.label')}>
          {shown.length === 0 && <p class="captions-empty">{t('translate.empty')}</p>}
          <ul class="captions-lines">
            {shown.map((l) => {
              const r = results[l.id];
              return (
                <li key={l.id} class="captions-line" data-kind="translation">
                  <span>
                    {r === null
                      ? t('translate.pending')
                      : 'text' in r!
                        ? r.text
                        : t('translate.unavailable')}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
