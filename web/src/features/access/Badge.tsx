import { useState } from 'preact/hooks';
import { t, getLang } from '../../i18n';
import { badgeIsEmpty, loadBadge, saveBadge, type Badge as BadgeData } from './badge-store';
import { cardText, loadCardLang, type CardLang } from './card-text';
import { trackAccess } from './events';
import { ShowToPerson } from './ShowToPerson';
import './access-cards.css';

/** Badge lines in the card language: name, pronouns, then each preference. */
export function badgeLines(b: BadgeData, lang: CardLang): string[] {
  const lines: string[] = [];
  if (b.name.trim()) lines.push(b.name.trim());
  if (b.pronouns.trim()) lines.push(b.pronouns.trim());
  if (b.text) lines.push(cardText(lang, 'access.badge.pref.text'));
  if (b.quiet) lines.push(cardText(lang, 'access.badge.pref.quiet'));
  if (b.slow) lines.push(cardText(lang, 'access.badge.pref.slow'));
  return lines;
}

export function Badge() {
  const [badge, setBadge] = useState<BadgeData>(() => loadBadge());
  const [status, setStatus] = useState('');
  const [showing, setShowing] = useState<{ opener: HTMLElement } | null>(null);
  const cardLang = loadCardLang(getLang());
  const empty = badgeIsEmpty(badge);

  const update = (patch: Partial<BadgeData>) => {
    const next = { ...badge, ...patch };
    setBadge(next);
    // Saved on every change; the polite status announces it (IN-3).
    setStatus(saveBadge(next) ? t('access.badge.saved') : '');
  };

  return (
    <section aria-labelledby="badge-title">
      <h2 id="badge-title">{t('access.badge.title')}</h2>
      <p>{t('access.badge.intro')}</p>

      <div class="field">
        <label for="badge-name">{t('access.badge.name')}</label>
        <input
          id="badge-name"
          type="text"
          autoComplete="off"
          value={badge.name}
          onInput={(e) => update({ name: e.currentTarget.value })}
        />
      </div>
      <div class="field">
        <label for="badge-pronouns">{t('access.badge.pronouns')}</label>
        <input
          id="badge-pronouns"
          type="text"
          autoComplete="off"
          value={badge.pronouns}
          onInput={(e) => update({ pronouns: e.currentTarget.value })}
        />
      </div>
      <fieldset class="field">
        <legend>{t('access.badge.title')}</legend>
        {(['text', 'quiet', 'slow'] as const).map((k) => (
          <label key={k} class="check">
            <input
              type="checkbox"
              checked={badge[k]}
              onChange={(e) => update({ [k]: e.currentTarget.checked })}
            />
            <span>{t(`access.badge.pref.${k}`)}</span>
          </label>
        ))}
      </fieldset>
      <p class="hint">{t('access.badge.privacy')}</p>
      <p class="hint" role="status">
        {status}
      </p>
      <button
        type="button"
        class="btn"
        disabled={empty}
        aria-describedby={empty ? 'badge-empty' : undefined}
        onClick={(e) => {
          void trackAccess({ name: 'kc.access.card_shown', attrs: { preset: 'badge' } });
          setShowing({ opener: e.currentTarget });
        }}
      >
        {t('access.badge.show')}
      </button>
      {empty && (
        <p id="badge-empty" class="hint">
          {t('access.badge.empty')}
        </p>
      )}
      {showing && (
        <ShowToPerson
          text={badgeLines(badge, cardLang).join('\n')}
          lang={cardLang}
          returnTo={showing.opener}
          onClose={() => setShowing(null)}
        />
      )}
    </section>
  );
}
