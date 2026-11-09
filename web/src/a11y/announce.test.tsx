import { act, cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { announce } from './announce';
import { LiveRegions } from './LiveRegions';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('announce', () => {
  it('writes polite and assertive messages into separate live regions', () => {
    vi.useFakeTimers();
    render(<LiveRegions />);
    act(() => {
      announce('Saved');
      announce('Failed', 'assertive');
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('announce-polite').textContent).toBe('Saved');
    expect(screen.getByTestId('announce-assertive').textContent).toBe('Failed');
  });

  it('announces the same text again after clearing', () => {
    vi.useFakeTimers();
    render(<LiveRegions />);
    act(() => {
      announce('Same');
      vi.advanceTimersByTime(100);
    });
    act(() => {
      announce('Same');
    });
    expect(screen.getByTestId('announce-polite').textContent).toBe('');
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByTestId('announce-polite').textContent).toBe('Same');
  });

  it('is a no-op when no regions are mounted', () => {
    expect(() => announce('nobody listening')).not.toThrow();
  });
});
