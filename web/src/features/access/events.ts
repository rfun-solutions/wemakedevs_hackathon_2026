// Browser telemetry for the access kit. NO free text, badge fields or card text, ever (DD-3).
// Dash0 events are optional: without a token (or on any error) these are silent no-ops.
type Attrs = Record<string, string | number | boolean>;

export type AccessEvent =
  | { name: 'kc.access.card_shown'; attrs: { preset: string } }
  | { name: 'kc.access.calm_places_viewed'; attrs?: undefined }
  | { name: 'kc.access.display_mode_changed'; attrs: { mode: string; on: boolean } }
  | { name: 'kc.access.lang_changed'; attrs: { lang: string } };

export async function trackAccess(ev: AccessEvent): Promise<void> {
  if (!import.meta.env.VITE_DASH0_INGEST_TOKEN) return;
  try {
    const { sendEvent } = await import('@dash0/sdk-web');
    sendEvent(ev.name, ev.attrs ? { attributes: ev.attrs as Attrs } : undefined);
  } catch {
    /* telemetry must never break the app */
  }
}
