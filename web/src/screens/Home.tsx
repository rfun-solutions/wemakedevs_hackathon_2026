import { t } from '../i18n';

export function Home() {
  return (
    <section aria-labelledby="home-title">
      <h2 id="home-title">{t('app.home.title')}</h2>
      <p>{t('app.home.intro')}</p>
    </section>
  );
}
