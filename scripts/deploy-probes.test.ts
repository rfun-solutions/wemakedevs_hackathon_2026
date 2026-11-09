import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

// KC-1: pods were killed by liveness during a slow boot (38s to listen on a busy node; ~30s liveness budget).
interface Probe {
  httpGet?: { path?: string };
  periodSeconds?: number;
  failureThreshold?: number;
  initialDelaySeconds?: number;
}
const deploy = parse(readFileSync(new URL('../deploy/deployment.yaml', import.meta.url), 'utf8'));
const app = deploy.spec.template.spec.containers.find((c: { name: string }) => c.name === 'app') as {
  startupProbe?: Probe;
  livenessProbe?: Probe;
};
const budget = (p: Probe) => (p.initialDelaySeconds ?? 0) + (p.periodSeconds ?? 10) * (p.failureThreshold ?? 3);

describe('app probes', () => {
  it('has a startup probe on /healthz with at least 60s of boot budget (observed worst case 38s)', () => {
    expect(app.startupProbe?.httpGet?.path).toBe('/healthz');
    expect(budget(app.startupProbe!)).toBeGreaterThanOrEqual(60);
  });

  it('keeps liveness tight once started (not loosened to hide the boot)', () => {
    expect(app.livenessProbe?.httpGet?.path).toBe('/healthz');
    expect(budget(app.livenessProbe!)).toBeLessThanOrEqual(30);
  });
});
