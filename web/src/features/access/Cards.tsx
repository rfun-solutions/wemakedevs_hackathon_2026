import { useRef, useState } from 'preact/hooks';
import { t, getLang } from '../../i18n';
import {
  CARD_LANGS,
  PRESET_IDS,
  cardText,
  isCardLang,
  loadCardLang,
  saveCardLang,
  type CardLang,
} from './card-text';
import { trackAccess } from './events';
import { ShowToPerson } from './ShowToPerson';
import './access-cards.css';

interface Shown {
  opener: HTMLElement | null;
  text: string;
  lang: CardLang;
}

export function Cards() {
  const [cardLang, setCardLang] = useState<CardLang>(() => loadCardLang(getLang()));
  const [custom, setCustom] = useState('');
  const [shown, setShown] = useState<Shown | null>(null);
  const empty = custom.trim() === '';
  const customRef = useRef<HTMLTextAreaElement>(null);

  const open = (preset: string, text: string, opener: HTMLElement | null) => {
    void trackAccess({ name: 'kc.access.card_shown', attrs: { preset } });
    setShown({ text, lang: cardLang, opener });
  };

  return (
    <section aria-labelledby="cards-title">
      <h2 id="cards-title">{t('access.cards.title')}</h2>
      <p>{t('access.cards.intro')}</p>

      <div class="field">
        <label for="card-lang">{t('access.cards.lang.label')}</label>
        <select
          id="card-lang"
          value={cardLang}
          onChange={(e) => {
            const v = e.currentTarget.value;
            if (isCardLang(v)) {
              setCardLang(v);
              saveCardLang(v);
            }
          }}
        >
          {CARD_LANGS.map((l) => (
            <option key={l} value={l} lang={l}>
              {t(`access.cardlang.${l}`)}
            </option>
          ))}
        </select>
      </div>

      <h3>{t('access.cards.presets')}</h3>
      <ul class="card-list">
        {PRESET_IDS.map((id) => {
          const text = cardText(cardLang, `access.card.${id}`);
          return (
            <li key={id}>
              <button
                type="button"
                class="card-btn"
                lang={cardLang}
                dir={cardLang === 'ar' ? 'rtl' : 'ltr'}
                onClick={(e) => open(id, text, e.currentTarget)}
              >
                {text}
              </button>
            </li>
          );
        })}
      </ul>

      <h3>{t('access.cards.custom.label')}</h3>
      <div class="field">
        <label for="card-custom">{t('access.cards.custom.label')}</label>
        <textarea
          id="card-custom"
          ref={customRef}
          rows={3}
          value={custom}
          aria-describedby="card-custom-hint"
          lang={cardLang}
          dir={cardLang === 'ar' ? 'rtl' : 'ltr'}
          onInput={(e) => setCustom(e.currentTarget.value)}
        />
        <p id="card-custom-hint" class="hint" role="status">
          {empty ? t('access.cards.custom.hint') : ''}
        </p>
        <button
          type="button"
          class="btn"
          disabled={empty}
          onClick={(e) => open('custom', custom.trim(), e.currentTarget)}
        >
          {t('access.cards.custom.show')}
        </button>
      </div>

      {shown && (
        <ShowToPerson
          text={shown.text}
          lang={shown.lang}
          returnTo={shown.opener}
          onClose={() => setShown(null)}
        />
      )}
    </section>
  );
}
