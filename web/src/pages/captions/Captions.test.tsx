import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/preact';
import type { CaptionStatus } from '../../lib/speech';
import type { CaptionSegment } from '../../lib/speech/types';

const enqueueNote = vi.fn();
let onSegment: (s: CaptionSegment) => void = () => undefined;
let onStatus: (s: CaptionStatus) => void = () => undefined;
let requestConsent: (() => Promise<boolean>) | undefined;
const stop = vi.fn();
const startCaptions = vi.fn();

vi.mock('../../lib/capture/queue', () => ({ enqueueNote: (...a: unknown[]) => enqueueNote(...a) }));
vi.mock('../../lib/speech', () => ({ startCaptions: (...a: unknown[]) => startCaptions(...a) }));

import { Captions } from './Captions';

beforeEach(() => {
  enqueueNote.mockReset().mockResolvedValue({ client_id: 'c1' });
  stop.mockReset();
  startCaptions.mockReset().mockImplementation(async (seg, opts) => {
    onSegment = seg;
    onStatus = opts.onStatus;
    requestConsent = opts.requestConsent;
    opts.onStatus({ type: 'engine', engine: 'webspeech', fallback: false });
    return { supported: true, engine: 'webspeech', stop };
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T21:05:09Z'));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

async function turnOn() {
  fireEvent.click(screen.getByRole('button', { name: 'Turn on captions' }));
  await screen.findByRole('button', { name: 'Turn off captions' });
}
const say = (id: string, text: string, final = true) =>
  act(() => onSegment({ id, text, lang: 'en', final }));

describe('Captions screen', () => {
  it('shows the live log, mic intro, engine label and near-live hint', async () => {
    render(<Captions />);
    expect(screen.getByRole('log').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByText(/Your phone will ask once/)).toBeTruthy();
    await turnOn();
    expect(screen.getByText(/Captions by: Browser speech/)).toBeTruthy();
    expect(screen.getByText(/near-live/)).toBeTruthy();
  });

  it('appends caption lines and updates an interim line in place', async () => {
    render(<Captions />);
    await turnOn();
    await say('a', 'hello wor', false);
    await say('a', 'hello world', true);
    await say('b', 'second line');
    const items = screen.getByRole('log').querySelectorAll('li');
    expect([...items].map((li) => li.querySelector('span')?.textContent)).toEqual([
      'hello world',
      'second line',
    ]);
  });

  it('Save as note calls enqueueNote with source caption and announces it', async () => {
    render(<Captions />);
    await turnOn();
    await say('a', 'Kubernetes is neat');
    fireEvent.click(screen.getByRole('button', { name: 'Save as note: Kubernetes is neat' }));
    await waitFor(() =>
      expect(enqueueNote).toHaveBeenCalledWith({ body: 'Kubernetes is neat', source: 'caption' }),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved as a note.'));
  });

  it('shows a plain message when saving fails', async () => {
    enqueueNote.mockRejectedValue(new Error('nope'));
    render(<Captions />);
    await turnOn();
    await say('a', 'x');
    fireEvent.click(screen.getByRole('button', { name: /Save as note/ }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toMatch(/Could not save/));
  });

  it('Insert time mark adds a venue-time line and saves [mark HH:MM:SS] <last line>', async () => {
    render(<Captions />);
    await turnOn();
    await say('a', 'first');
    await say('b', 'the last caption');
    fireEvent.click(screen.getByRole('button', { name: 'Insert time mark' }));
    await waitFor(() =>
      expect(enqueueNote).toHaveBeenCalledWith({
        body: '[mark 14:05:09] the last caption',
        source: 'caption',
      }),
    );
    expect(screen.getByRole('log').textContent).toContain('Mark 14:05:09');
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Time mark 14:05:09 added and saved.'),
    );
  });

  it('time mark works before any caption and when saving is queued offline', async () => {
    render(<Captions />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert time mark' }));
    await waitFor(() =>
      expect(enqueueNote).toHaveBeenCalledWith({ body: '[mark 14:05:09]', source: 'caption' }),
    );
  });

  it('mark lines have no Save as note button, and each mark button is a real button', async () => {
    render(<Captions />);
    fireEvent.click(screen.getByRole('button', { name: 'Insert time mark' }));
    await screen.findByText('Mark 14:05:09');
    expect(screen.queryByRole('button', { name: /Save as note/ })).toBeNull();
  });

  it('announces status messages in the status region', async () => {
    render(<Captions />);
    await turnOn();
    act(() => onStatus({ type: 'switched', from: 'whisper', to: 'webspeech' }));
    expect(screen.getByRole('status').textContent).toBe(
      'Captions were falling behind, so we switched to Browser speech.',
    );
    act(() => onStatus({ type: 'slow_here' }));
    expect(screen.getByRole('status').textContent).toBe(
      'Captions are falling behind on this phone.',
    );
    act(() => onStatus({ type: 'slow_everyone' }));
    expect(screen.getByRole('status').textContent).toMatch(/slow for everyone/);
  });

  it('keeps the "slow for everyone" message when the engine then starts', async () => {
    startCaptions.mockImplementation(async (_s, opts) => {
      opts.onStatus({ type: 'slow_everyone' });
      opts.onStatus({ type: 'engine', engine: 'webspeech', fallback: false });
      return { supported: true, engine: 'webspeech', stop() {} };
    });
    render(<Captions />);
    await turnOn();
    expect(screen.getByRole('status').textContent).toMatch(/slow for everyone/);
  });

  it('unsupported shows the typed-caption field feeding the same log', async () => {
    startCaptions.mockImplementation(async (_s, opts) => {
      opts.onStatus({ type: 'unsupported' });
      return { supported: false, stop() {} };
    });
    render(<Captions />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on captions' }));
    const input = (await screen.findByLabelText('Type a caption line')) as HTMLInputElement;
    input.value = 'typed words';
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(screen.getByRole('log').textContent).toContain('typed words'));
  });

  it('consent: Download now and the decline button resolve the request', async () => {
    render(<Captions />);
    await turnOn();
    let result: boolean | undefined;
    act(() => void requestConsent!().then((v) => (result = v)));
    expect(screen.getByText(/about 117 MB/)).toBeTruthy();
    fireEvent.click(screen.getByText('Use browser speech instead'));
    await waitFor(() => expect(result).toBe(false));
    act(() => void requestConsent!().then((v) => (result = v)));
    fireEvent.click(screen.getByText('Download now'));
    await waitFor(() => expect(result).toBe(true));
  });

  it('a session that finishes starting after the page was left is stopped', async () => {
    let finish!: (v: unknown) => void;
    startCaptions.mockImplementation(() => new Promise((r) => (finish = r)));
    const view = render(<Captions />);
    fireEvent.click(screen.getByRole('button', { name: 'Turn on captions' }));
    view.unmount();
    await act(async () => finish({ supported: true, engine: 'webspeech', stop }));
    expect(stop).toHaveBeenCalled();
  });

  it('hides Cancel download once the engine has switched', async () => {
    render(<Captions />);
    await turnOn();
    act(() => onStatus({ type: 'downloading', loaded: 1, total: 10 }));
    expect(screen.getByRole('button', { name: 'Cancel download' })).toBeTruthy();
    act(() => onStatus({ type: 'switched', from: 'webspeech', to: 'whisper' }));
    expect(screen.queryByRole('button', { name: 'Cancel download' })).toBeNull();
  });

  it('turning captions off stops the session', async () => {
    render(<Captions />);
    await turnOn();
    fireEvent.click(screen.getByRole('button', { name: 'Turn off captions' }));
    expect(stop).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Turn on captions' })).toBeTruthy();
  });
});
