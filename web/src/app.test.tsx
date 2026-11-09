import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/preact';
import { App } from './app';

afterEach(cleanup);

describe('shell', () => {
  it('renders the app name, a real button, a live region and the nav', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('KubeCompanion');
    expect(screen.getByRole('button', { name: 'Español' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy();
    expect(screen.getByRole('navigation')).toBeTruthy();
  });
});
