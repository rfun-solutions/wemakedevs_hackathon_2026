import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/preact';
import { setLang } from '../../i18n';
import { Agent0Line, agoLabel } from './Agent0Line';

const NOW = Date.parse('2026-11-09T18:00:00Z');

function mockExplain(body: object | Error, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      if (body instanceof Error) throw body;
      return new Response(JSON.stringify(body), { status });
    }),
  );
}

beforeEach(() => setLang('en'));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('agoLabel', () => {
  it('uses seconds, minutes, hours', () => {
    expect(agoLabel(12)).toEqual({ key: 'status.agent0.ago.s', n: 12 });
    expect(agoLabel(300)).toEqual({ key: 'status.agent0.ago.m', n: 5 });
    expect(agoLabel(7200)).toEqual({ key: 'status.agent0.ago.h', n: 2 });
    expect(agoLabel(-5).n).toBe(0);
  });
});

describe('Agent0Line', () => {
  it('shows the sentence with its age and the AI-generated label', async () => {
    mockExplain({ text: 'The agenda is slow.', at: '2026-11-09T17:59:30Z', source: 'agent0' });
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() =>
      expect(screen.getByText(/Agent0, 30 s ago: The agenda is slow\./)).toBeTruthy(),
    );
    expect(screen.getByText('AI-generated')).toBeTruthy();
  });

  it('says not available when there is no text, never inventing one', async () => {
    mockExplain({ text: null, at: null, source: 'none' });
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() =>
      expect(screen.getByText('Explanation not available right now.')).toBeTruthy(),
    );
    expect(screen.queryByText('AI-generated')).toBeNull();
  });

  it('says not available when the request fails or is not ok', async () => {
    mockExplain(new Error('down'));
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() =>
      expect(screen.getByText('Explanation not available right now.')).toBeTruthy(),
    );
    cleanup();
    mockExplain({}, 500);
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() =>
      expect(screen.getByText('Explanation not available right now.')).toBeTruthy(),
    );
  });

  it('renders Spanish chrome', async () => {
    setLang('es');
    mockExplain({ text: 'La agenda va lenta.', at: '2026-11-09T17:59:30Z' });
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() => expect(screen.getByText('Generado por IA')).toBeTruthy());
  });

  it('makes no network call when offline', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const spy = vi.fn();
    vi.stubGlobal('fetch', spy);
    render(<Agent0Line now={() => NOW} />);
    await waitFor(() =>
      expect(screen.getByText('Explanation not available right now.')).toBeTruthy(),
    );
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
