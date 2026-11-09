import { useEffect, useState } from 'preact/hooks';
import { getLang, t } from '../i18n';
import { fetchAgenda, removeFromAgenda, type AgendaResponse } from './scheduleApi';
import { formatDay, groupByDay, warningsByTarget } from './scheduleFormat';
import { currentOrNextSession } from './scheduleNow';
import { focusSession, SessionCard, useNow } from './scheduleShared';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: AgendaResponse };

export function Agenda() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [live, setLive] = useState('');
  const now = useNow();
  const lang = getLang();

  const reload = () => {
    setLoad({ state: 'loading' });
    fetchAgenda()
      .then((data) => setLoad({ state: 'ready', data }))
      .catch(() => setLoad({ state: 'error' }));
  };
  useEffect(reload, []);

  const items = load.state === 'ready' ? load.data.items : [];
  const warnings = load.state === 'ready' ? warningsByTarget(load.data.warnings) : new Map();
  const walk = load.state === 'ready' ? load.data.warnings[0]?.walkMinutes : undefined;
  const marked = currentOrNextSession(items, now);

  async function remove(id: string, title: string) {
    try {
      await removeFromAgenda(id);
    } catch {
      setLive(t('schedule.live.failed'));
      return;
    }
    setLoad((l) =>
      l.state === 'ready'
        ? {
            state: 'ready',
            data: {
              items: l.data.items.filter((i) => i.id !== id),
              warnings: l.data.warnings.filter(
                (w) => w.fromSessionId !== id && w.toSessionId !== id,
              ),
            },
          }
        : l,
    );
    setLive(t('schedule.live.removed', { title }));
    fetchAgenda()
      .then((data) => setLoad({ state: 'ready', data }))
      .catch(() => undefined);
  }

  function jumpToNow() {
    const hit = currentOrNextSession(items, now);
    if (!hit) {
      setLive(t('schedule.now.none'));
      return;
    }
    setLive(
      t(hit.state === 'current' ? 'schedule.now.liveCurrent' : 'schedule.now.liveNext', {
        title: hit.session.title,
      }),
    );
    focusSession(hit.session.id);
  }

  return (
    <section aria-labelledby="agenda-title" class="sch">
      <h2 id="agenda-title">{t('schedule.agenda.title')}</h2>
      <p class="sch-note">{t('schedule.zoneNote')}</p>

      {load.state === 'loading' && <p role="status">{t('schedule.loading')}</p>}
      {load.state === 'error' && (
        <div role="alert">
          <p>{t('schedule.error')}</p>
          <button type="button" class="btn" onClick={reload}>
            {t('schedule.retry')}
          </button>
        </div>
      )}

      {load.state === 'ready' && items.length === 0 && (
        <div>
          <p>{t('schedule.agenda.empty')}</p>
          <a class="btn" href="/schedule">
            {t('schedule.agenda.browse')}
          </a>
        </div>
      )}

      {load.state === 'ready' && items.length > 0 && (
        <>
          <button type="button" class="btn sch-jump" onClick={jumpToNow}>
            {t('schedule.now.jump')}
          </button>
          {walk !== undefined && <p class="sch-note">{t('schedule.agenda.walkHint', { walk })}</p>}
          {groupByDay(items).map(([day, group]) => (
            <section key={day} aria-labelledby={`agenda-day-${day}`}>
              <h3 id={`agenda-day-${day}`} class="sch-day-title">
                {formatDay(day, lang, true)}
              </h3>
              <ul class="sch-list">
                {group.map((s) => (
                  <SessionCard
                    key={s.id}
                    session={s}
                    marker={marked?.session.id === s.id ? marked.state : null}
                    warning={warnings.get(s.id)}
                    titleLevel={4}
                    noteHref={`/capture?session=${encodeURIComponent(s.id)}`}
                    action={
                      <button
                        type="button"
                        class="btn"
                        aria-label={`${t('schedule.remove')}: ${s.title}`}
                        onClick={() => void remove(s.id, s.title)}
                      >
                        {t('schedule.remove')}
                      </button>
                    }
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
      <div class="visually-hidden" role="status" aria-live="polite">
        {live}
      </div>
    </section>
  );
}
