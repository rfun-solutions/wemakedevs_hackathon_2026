import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { setLang } from '../../i18n';
import { Status } from './Status';

const base = {
  server_ms_p95: 120,
  feed_synced_at: '2026-11-09T17:56:00Z',
  feed_age_s: 240,
  slo_ms: 500,
  chaos_active: false,
};

function mockFetch(status: object | Error, pingMs = 0) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      if (url === '/api/status') {
        if (status instanceof Error) throw status;
        return new Response(JSON.stringify(status), { status: 200 });
      }
      if (pingMs) await new Promise((r) => setTimeout(r, pingMs));
      return new Response(null, { status: 204 });
    }),
  );
  return calls;
}

beforeEach(() => setLang('en'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Status screen', () => {
  it('shows all good, feed age and a null save time without crashing', async () => {
    mockFetch(base);
    render(<Status />);
    await waitFor(() => expect(screen.getByText('Schedule updated 4 min ago')).toBeTruthy());
    expect(screen.getByText('All good.')).toBeTruthy();
    expect(screen.getByText('No note saved on this phone yet')).toBeTruthy();
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    const verdict = screen.getByText('All good.');
    expect(verdict.parentElement?.getAttribute('aria-live')).toBe('polite');
    expect(verdict.parentElement?.getAttribute('aria-atomic')).toBe('true');
  });

  it('says the app is slow when server p95 is over the SLO', async () => {
    mockFetch({ ...base, server_ms_p95: 900, chaos_active: true });
    render(<Status />);
    await waitFor(() =>
      expect(screen.getByText('We are slow right now, not your Wi-Fi.')).toBeTruthy(),
    );
    const chaos = screen.getByText('A planned test slowdown is switched on.');
    expect(chaos.parentElement?.getAttribute('aria-live')).toBe('polite');
  });

  it('says the connection is slow when RTT is over 400 ms and the server is within SLO', async () => {
    mockFetch(base, 450);
    render(<Status />);
    await waitFor(
      () => expect(screen.getByText('Your connection looks slow, not us.')).toBeTruthy(),
      {
        timeout: 4000,
      },
    );
  });

  it('bounds status, ping and RTT requests with timeout signals', async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        requests.push({ url, init });
        if (url === '/api/status') return new Response(JSON.stringify(base), { status: 200 });
        return new Response(null, { status: 204 });
      }),
    );
    render(<Status />);
    await waitFor(() => expect(requests.some(({ url }) => url === '/api/status/rtt')).toBe(true));

    for (const path of ['/api/status', '/api/ping', '/api/status/rtt']) {
      const matching = requests.filter(({ url }) => url === path);
      expect(matching.length).toBeGreaterThan(0);
      expect(matching.every(({ init }) => init?.signal instanceof AbortSignal)).toBe(true);
    }
  });

  it('is offline: queued message and no network call', () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const calls = mockFetch(base);
    render(<Status />);
    expect(screen.getByText('You are offline. Your notes are queued on this phone.')).toBeTruthy();
    expect(calls).toEqual([]);
  });

  it('shows a plain error when the status call fails', async () => {
    mockFetch(new Error('down'));
    render(<Status />);
    await waitFor(() => expect(screen.getByText(/could not reach the app/)).toBeTruthy());
    const error = screen.getByRole('alert');
    expect(error.getAttribute('id')).toBe('status-error');
    expect(error.parentElement?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders Spanish strings', async () => {
    setLang('es');
    mockFetch(base);
    render(<Status />);
    await waitFor(() => expect(screen.getByText('Programa actualizado hace 4 min')).toBeTruthy());
  });
});
