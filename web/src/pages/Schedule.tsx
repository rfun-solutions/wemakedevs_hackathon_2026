import { useEffect, useMemo, useState } from 'preact/hooks';
import { getLang, t } from '../i18n';
import {
  addToAgenda,
  fetchAgenda,
  fetchSessions,
  removeFromAgenda,
  type SessionsResponse,
} from './scheduleApi';
import { formatDay } from './scheduleFormat';
import { currentOrNextSession, venueDay } from './scheduleNow';
import { focusSession, SessionCard, useNow } from './scheduleShared';

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; data: SessionsResponse };

export function Schedule() {
  const [load, setLoad] = useState<Load>({ state: 'loading' });
  const [agenda, setAgenda] = useState<Set<string>>(new Set());
  const [day, setDay] = useState<string | null>(null);
  const [room, setRoom] = useState('');
  const [track, setTrack] = useState('');
  const [live, setLive] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow();
  const lang = getLang();

  const reload = () => {
    setLoad({ state: 'loading' });
    fetchSessions()
      .then((data) => {
        setLoad({ state: 'ready', data });
        setDay((d) => {
          if (d && data.filters.days.includes(d)) return d;
          const today = venueDay(new Date());
          return data.filters.days.includes(today) ? today : (data.filters.days[0] ?? null);
        });
      })
      .catch(() => setLoad({ state: 'error' }));
    // The agenda only decides button states; the schedule still works if it fails.
    fetchAgenda()
      .then((a) => setAgenda(new Set(a.items.map((i) => i.id))))
      .catch(() => undefined);
  };
  useEffect(reload, []);

  const sessions = load.state === 'ready' ? load.data.sessions : [];
  const filtered = useMemo(
    () =>
      sessions.filter(
        (s) =>
          (!day || venueDay(s.startsAt) === day) &&
          (!room || s.room === room) &&
          (!track || s.track === track),
      ),
    [sessions, day, room, track],
  );
  const globalHit = currentOrNextSession(sessions, now);
  const marked =
    globalHit && filtered.some((s) => s.id === globalHit.session.id) ? globalHit : null;

  async function toggle(id: string, title: string) {
    const adding = !agenda.has(id);
    setBusy(id);
    try {
      if (adding) await addToAgenda(id);
      else await removeFromAgenda(id);
      setAgenda((prev) => {
        const next = new Set(prev);
        if (adding) next.add(id);
        else next.delete(id);
        return next;
      });
      setLive(t(adding ? 'schedule.live.added' : 'schedule.live.removed', { title }));
    } catch {
      setLive(t('schedule.live.failed'));
    } finally {
      setBusy(null);
    }
  }

  function jumpToNow() {
    if (load.state !== 'ready') return;
    const today = venueDay(now);
    let target = filtered;
    if (day !== today && load.data.filters.days.includes(today)) {
      // Switch to today and clear filters so the session in progress is visible.
      setDay(today);
      setRoom('');
      setTrack('');
      target = sessions.filter((s) => venueDay(s.startsAt) === today);
    }
    const hit = currentOrNextSession(target, now);
    if (!hit) {
      setLive(t('schedule.now.none'));
      return;
    }
    setLive(
      t(hit.state === 'current' ? 'schedule.now.liveCurrent' : 'schedule.now.liveNext', {
        title: hit.session.title,
      }),
    );
    // Wait for the filtered list to re-render before scrolling.
    setTimeout(() => focusSession(hit.session.id), 0);
  }

  return (
    <section aria-labelledby="schedule-title" class="sch">
      <h2 id="schedule-title">{t('schedule.title')}</h2>
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

      {load.state === 'ready' && (
        <>
          <div class="sch-filters" role="group" aria-label={t('schedule.filters.label')}>
            <div class="sch-days" role="group" aria-label={t('schedule.filters.day')}>
              {load.data.filters.days.map((d) => (
                <button
                  key={d}
                  type="button"
                  class="sch-day"
                  aria-pressed={d === day}
                  onClick={() => setDay(d)}
                >
                  {formatDay(d, lang)}
                </button>
              ))}
            </div>
            <label class="sch-field">
              <span>{t('schedule.filters.room')}</span>
              <select value={room} onChange={(e) => setRoom(e.currentTarget.value)}>
                <option value="">{t('schedule.filters.allRooms')}</option>
                {load.data.filters.rooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label class="sch-field">
              <span>{t('schedule.filters.track')}</span>
              <select value={track} onChange={(e) => setTrack(e.currentTarget.value)}>
                <option value="">{t('schedule.filters.allTracks')}</option>
                {load.data.filters.tracks.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" class="btn sch-jump" onClick={jumpToNow}>
              {t('schedule.now.jump')}
            </button>
          </div>

          <p class="sch-count">
            {filtered.length === 1
              ? t('schedule.count.one')
              : t('schedule.count', { n: filtered.length })}
          </p>
          {filtered.length === 0 ? (
            <p>{t('schedule.empty')}</p>
          ) : (
            <ul class="sch-list">
              {filtered.map((s) => {
                const added = agenda.has(s.id);
                return (
                  <SessionCard
                    key={s.id}
                    session={s}
                    showTags
                    marker={marked?.session.id === s.id ? marked.state : null}
                    action={
                      <button
                        type="button"
                        class={added ? 'btn sch-added' : 'btn'}
                        aria-pressed={added}
                        aria-label={`${added ? t('schedule.added') : t('schedule.add')}: ${s.title}`}
                        disabled={busy === s.id}
                        onClick={() => void toggle(s.id, s.title)}
                      >
                        {added ? t('schedule.added') : t('schedule.add')}
                      </button>
                    }
                  />
                );
              })}
            </ul>
          )}
        </>
      )}
      <div class="visually-hidden" role="status" aria-live="polite">
        {live}
      </div>
    </section>
  );
}
