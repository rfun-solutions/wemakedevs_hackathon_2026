import { useEffect, useState } from 'preact/hooks';
import { getLang, t } from '../i18n';
import './schedule.css';
import { formatTimeRange, location } from './scheduleFormat';
import type { BuildingWarning, Session } from './scheduleApi';
import { warningMessage } from './scheduleFormat';

/** Current time, refreshed every 30 s so the "Now" marker follows the clock. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Visible, text-based marker (never colour alone). */
export function NowBadge({ state }: { state: 'current' | 'next' }) {
  return (
    <span class={`sch-badge sch-badge-${state}`}>
      {state === 'current' ? t('schedule.now.badge') : t('schedule.now.next')}
    </span>
  );
}

export function Warning({ warning }: { warning: BuildingWarning }) {
  const m = warningMessage(warning);
  const tight = warning.level === 'tight';
  return (
    <p class={`sch-warning ${tight ? 'sch-warning-tight' : 'sch-warning-ok'}`}>
      <span aria-hidden="true" class="sch-warning-icon">
        {tight ? '⚠' : 'ℹ'}
      </span>
      <span class="visually-hidden">
        {t(tight ? 'schedule.warning.iconTight' : 'schedule.warning.iconOk')}:{' '}
      </span>
      {t(m.key, m.params)}
    </p>
  );
}

export function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <div class="sch-tags">
      <span class="sch-tags-note">{t('schedule.tags.estimated')}:</span>
      <ul aria-label={t('schedule.tags.label')}>
        {tags.map((tag) => (
          <li key={tag}>{t(`schedule.tag.${tag}`)}</li>
        ))}
      </ul>
    </div>
  );
}

export interface SessionCardProps {
  session: Session;
  marker: 'current' | 'next' | null;
  warning?: BuildingWarning | undefined;
  showTags?: boolean;
  /** Primary action (add/remove). */
  action: preact.ComponentChildren;
  /** Link to B's capture screen with this session preselected (agenda only). */
  noteHref?: string;
  /** Heading level of the title: 3 on the schedule, 4 under the agenda's day headings. */
  titleLevel?: 3 | 4;
}

export function SessionCard({
  session: s,
  marker,
  warning,
  showTags,
  action,
  noteHref,
  titleLevel = 3,
}: SessionCardProps) {
  const lang = getLang();
  const Title = `h${titleLevel}` as 'h3' | 'h4';
  return (
    <li class={`sch-card${marker ? ' sch-card-marked' : ''}`} id={`session-${s.id}`} tabIndex={-1}>
      <p class="sch-time">
        {formatTimeRange(s, lang)}
        {marker && <NowBadge state={marker} />}
      </p>
      <Title class="sch-title">{s.title}</Title>
      <p class="sch-meta">
        {location(s)}
        {s.track ? ` · ${s.track}` : ''}
      </p>
      {showTags && <Tags tags={s.accessTags} />}
      {warning && <Warning warning={warning} />}
      <div class="sch-actions">
        {action}
        {noteHref && (
          <a class="sch-link" href={noteHref} aria-label={`${t('schedule.note')}: ${s.title}`}>
            {t('schedule.note')}
          </a>
        )}
      </div>
    </li>
  );
}

/** Scrolls to and focuses a session card. */
export function focusSession(id: string): boolean {
  const el = document.getElementById(`session-${id}`);
  if (!el) return false;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
  el.focus({ preventScroll: true });
  return true;
}
