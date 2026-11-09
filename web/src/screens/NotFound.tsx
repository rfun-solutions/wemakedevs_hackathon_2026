import { t } from '../i18n';

export function NotFound() {
  return (
    <section aria-labelledby="nf-title">
      <h2 id="nf-title">{t('app.notFound.title')}</h2>
      <p>
        <a href="/">{t('app.notFound.back')}</a>
      </p>
    </section>
  );
}
