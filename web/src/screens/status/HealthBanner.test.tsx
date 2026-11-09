import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { setLang } from '../../i18n';
import { HealthBanner, bannerLines, type HealthSnapshot } from './HealthBanner';

const base: HealthSnapshot = {
  source: 'dash0',
  routes: [{ route: '/api/agenda', p95Ms: 2000, slow: true }],
  captions: { lagging: false },
};

function mock(body: object | Error) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (body instanceof Error) throw body;
      return new Response(JSON.stringify(body));
    }),
  );
}

beforeEach(() => setLang('en'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('bannerLines', () => {
  it('is empty when unavailable, null or healthy', () => {
    expect(bannerLines(null)).toEqual([]);
    expect(bannerLines({ ...base, source: 'unavailable' })).toEqual([]);
    expect(
      bannerLines({ ...base, routes: [{ route: '/api/agenda', p95Ms: 100, slow: false }] }),
    ).toEqual([]);
  });
  it('names the agenda and captions', () => {
    expect(bannerLines({ ...base, captions: { lagging: true } }).map((l) => l.key)).toEqual([
      'status.health.agenda',
      'status.health.captions',
    ]);
  });
});

describe('HealthBanner', () => {
  it('says the agenda is slow for everyone in a polite live region', async () => {
    mock(base);
    render(<HealthBanner />);
    await waitFor(() =>
      expect(screen.getByText(/The agenda is slow for everyone.*about 2 s/)).toBeTruthy(),
    );
    expect(document.getElementById('status-health')?.getAttribute('aria-live')).toBe('polite');
  });
  it('renders Spanish', async () => {
    setLang('es');
    mock({ ...base, routes: [], captions: { lagging: true } });
    render(<HealthBanner />);
    await waitFor(() => expect(screen.getByText(/Los subtítulos van lentos/)).toBeTruthy());
  });
  it('shows nothing on a fetch failure', async () => {
    mock(new Error('down'));
    render(<HealthBanner />);
    await new Promise((r) => setTimeout(r, 20));
    expect(document.getElementById('status-health')?.textContent).toBe('');
  });
});
