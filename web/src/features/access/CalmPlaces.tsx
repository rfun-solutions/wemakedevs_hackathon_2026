import { useEffect } from 'preact/hooks';
import { t } from '../../i18n';
import { CALM_CHECKED, CALM_PLACES, CALM_SOURCE_URL } from './calm-places';
import { trackAccess } from './events';
import './access-cards.css';

export function CalmPlaces() {
  useEffect(() => {
    void trackAccess({ name: 'kc.access.calm_places_viewed' });
  }, []);
  return (
    <section aria-labelledby="calm-title">
      <h2 id="calm-title">{t('access.calm.title')}</h2>
      <p>{t('access.calm.intro')}</p>
      <ul class="calm-list">
        {CALM_PLACES.map((p) => (
          <li key={p.id}>
            <h3>{t(p.nameKey)}</h3>
            <p>{p.whereKey ? t(p.whereKey) : t('access.calm.ask')}</p>
          </li>
        ))}
      </ul>
      <p class="hint">
        <a href={CALM_SOURCE_URL} rel="noopener noreferrer">
          {t('access.calm.source')}
        </a>
        {'. '}
        {t('access.calm.checked', { date: CALM_CHECKED })}
      </p>
    </section>
  );
}
