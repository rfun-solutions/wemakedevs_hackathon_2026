import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/preact';
import { ENTRIES } from '../../under-the-hood/registry';
import { t } from '../../i18n';
import { UnderTheHood, needsSignin, techHref } from './UnderTheHood';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('UnderTheHood', () => {
  it('renders one section per registry entry and shows no live data when the API is missing', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
    render(<UnderTheHood />);
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(t('hood.title'));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(ENTRIES.length);
    expect(await screen.findAllByText('No live data right now')).not.toHaveLength(0);
    expect(await screen.findAllByRole('status')).not.toHaveLength(0);
  });
});

describe('links', () => {
  it('repo paths link to the public repo, Dash0 URLs never link', () => {
    expect(techHref({ sponsor: 'gitar', kind: 'rule', label: 'x', ref: 'a/b.md' })).toBe(
      'https://github.com/rfun-solutions/wemakedevs_hackathon_2026/blob/main/a/b.md',
    );
    const d = {
      sponsor: 'dash0',
      kind: 'query',
      label: 'q',
      ref: 'https://app.dash0.com/x',
    } as const;
    expect(techHref(d)).toBeNull();
    expect(needsSignin(d)).toBe(true);
    expect(
      techHref({ sponsor: 'radar', kind: 'investigation', label: 'r', ref: 'https://r.io/s' }),
    ).toBe('https://r.io/s');
    expect(needsSignin({ sponsor: 'radar', kind: 'investigation', label: 'r' })).toBe(false);
  });
});
