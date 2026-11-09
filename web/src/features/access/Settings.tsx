import { useEffect, useState } from 'preact/hooks';
import { announce } from '../../a11y/announce';
import { LANGS, LANG_NAMES, setLang, t, useLang, type Lang } from '../../i18n';
import {
  TYPE_SCALE_MAX,
  TYPE_SCALE_MIN,
  TYPE_SCALE_STEP,
  getPrefs,
  onPrefsChange,
  setPrefs,
  type DisplayPrefs,
} from '../../prefs/display';
import './settings.css';

function usePrefs(): DisplayPrefs {
  const [prefs, setState] = useState<DisplayPrefs>(getPrefs());
  useEffect(() => onPrefsChange(setState), []);
  return prefs;
}

export function Settings() {
  const lang = useLang();
  const prefs = usePrefs();
  const percent = Math.round(prefs.typeScale * 100);

  const toggle = (key: string, on: boolean) =>
    announce(t(`access.settings.${key}.${on ? 'on' : 'off'}`));

  return (
    <section class="settings" aria-labelledby="settings-title">
      <h2 id="settings-title">{t('access.settings.title')}</h2>

      <div class="field">
        <label for="type-scale">{t('access.settings.type.label')}</label>
        <div class="field-row">
          <input
            id="type-scale"
            class="range"
            type="range"
            min={TYPE_SCALE_MIN * 100}
            max={TYPE_SCALE_MAX * 100}
            step={TYPE_SCALE_STEP * 100}
            value={percent}
            aria-describedby="type-scale-help"
            aria-valuetext={t('access.settings.type.value', { percent })}
            onInput={(e) => {
              const p = Number((e.currentTarget as HTMLInputElement).value);
              setPrefs({ typeScale: p / 100 });
              announce(t('access.settings.type.announce', { percent: p }));
            }}
          />
          <output for="type-scale">{t('access.settings.type.value', { percent })}</output>
        </div>
        <p id="type-scale-help" class="help">
          {t('access.settings.type.help')}
        </p>
      </div>

      <div class="field">
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.font === 'atkinson'}
            aria-describedby="font-help"
            onChange={(e) => {
              const on = (e.currentTarget as HTMLInputElement).checked;
              setPrefs({ font: on ? 'atkinson' : 'system' });
              toggle('font', on);
            }}
          />
          <span>{t('access.settings.font.label')}</span>
        </label>
        <p id="font-help" class="help">
          {t('access.settings.font.help')}
        </p>
      </div>

      <div class="field">
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.contrast === 'high'}
            aria-describedby="contrast-help"
            onChange={(e) => {
              const on = (e.currentTarget as HTMLInputElement).checked;
              setPrefs({ contrast: on ? 'high' : 'normal' });
              toggle('contrast', on);
            }}
          />
          <span>{t('access.settings.contrast.label')}</span>
        </label>
        <p id="contrast-help" class="help">
          {t('access.settings.contrast.help')}
        </p>
      </div>

      <div class="field">
        <label class="check">
          <input
            type="checkbox"
            checked={prefs.motion === 'reduced'}
            aria-describedby="motion-help"
            onChange={(e) => {
              const on = (e.currentTarget as HTMLInputElement).checked;
              setPrefs({ motion: on ? 'reduced' : 'normal' });
              toggle('motion', on);
            }}
          />
          <span>{t('access.settings.motion.label')}</span>
        </label>
        <p id="motion-help" class="help">
          {t('access.settings.motion.help')}
        </p>
      </div>

      <fieldset class="field">
        <legend>{t('access.settings.lang.label')}</legend>
        {LANGS.map((l: Lang) => (
          <label key={l} class="check">
            <input
              type="radio"
              name="lang"
              value={l}
              checked={lang === l}
              onChange={() => {
                setLang(l);
                announce(t('access.settings.lang.announce', { name: LANG_NAMES[l] }));
              }}
            />
            <span lang={l}>{LANG_NAMES[l]}</span>
          </label>
        ))}
        <p class="help">{t('access.settings.lang.disclosure')}</p>
      </fieldset>
    </section>
  );
}
