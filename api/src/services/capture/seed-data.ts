// Fixed, fictional demo data for the reserved demo device (POST /api/capture/seed).
// Every client_id is fixed so seeding is idempotent through unique (device_id, client_id).
// Names are invented and match no real attendee. created_at spans three Denver days (MST, UTC-7).

export interface SeedNote {
  client_id: string;
  body: string;
  source: 'typed' | 'dictated';
  topic: string;
  created_at: string;
}
export interface SeedPerson {
  client_id: string;
  name: string;
  context: string;
}
export interface SeedPromise {
  client_id: string;
  text: string;
  person_client_id: string;
  due: string | null;
  done: boolean;
}

export const SEED_NOTES: SeedNote[] = [
  {
    client_id: '00000000-0000-4000-8000-100000000001',
    body: 'Keynote: service mesh without sidecars. Ambient mode splits L4 and L7. Ask Priya about the migration path.',
    source: 'typed',
    topic: 'service mesh',
    created_at: '2026-11-10T09:15:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000002',
    body: 'Mesh talk Q&A: mTLS cost is mostly handshake, not throughput. Sidecar-less cut memory a lot in their demo.',
    source: 'typed',
    topic: 'service mesh',
    created_at: '2026-11-10T11:40:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000003',
    body: 'Met Marcus Okafor at the OpenTelemetry booth. He maintains a collector processor. Said to try the filter processor for noisy spans.',
    source: 'typed',
    topic: 'opentelemetry',
    created_at: '2026-11-10T13:05:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000004',
    body: 'OpenTelemetry sampling session: tail sampling needs one collector tier that sees whole traces. Head sampling is cheaper but blind to errors.',
    source: 'typed',
    topic: 'opentelemetry',
    created_at: '2026-11-10T15:30:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000005',
    body: 'Hallway: Lena Vasquez runs the accessibility working group. Captions at talks help me more than I expected.',
    source: 'dictated',
    topic: 'accessibility',
    created_at: '2026-11-10T17:20:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000006',
    body: 'Day 2 keynote: platform teams as product teams. Golden paths beat mandates.',
    source: 'typed',
    topic: 'service mesh',
    created_at: '2026-11-11T09:30:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000007',
    body: 'Mesh observability: use the mesh span metrics for per-route p95 before adding app metrics.',
    source: 'typed',
    topic: 'service mesh',
    created_at: '2026-11-11T10:50:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000008',
    body: 'Lunch with Marcus. He will share a sample collector config for span filtering.',
    source: 'typed',
    topic: 'opentelemetry',
    created_at: '2026-11-11T12:15:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000009',
    body: 'Semantic conventions talk: stable HTTP attributes now. Rename old http.method to http.request.method in dashboards.',
    source: 'typed',
    topic: 'opentelemetry',
    created_at: '2026-11-11T14:00:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000010',
    body: 'Accessibility talk: keyboard focus order and live regions for status messages. Native elements first, ARIA only when needed.',
    source: 'dictated',
    topic: 'accessibility',
    created_at: '2026-11-11T16:45:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000011',
    body: 'Day 3: Dev Chen showed a screen reader demo of a Kubernetes dashboard. Unlabelled icon buttons were the main problem.',
    source: 'typed',
    topic: 'accessibility',
    created_at: '2026-11-12T09:20:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000012',
    body: 'Mesh retro: roll out ambient per namespace, keep sidecars where policy needs L7 everywhere.',
    source: 'typed',
    topic: 'service mesh',
    created_at: '2026-11-12T11:10:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000013',
    body: 'OpenTelemetry demo: exemplars link a latency spike to a trace in one click. Worth setting up for p95 charts.',
    source: 'typed',
    topic: 'opentelemetry',
    created_at: '2026-11-12T13:30:00-07:00',
  },
  {
    client_id: '00000000-0000-4000-8000-100000000014',
    body: 'Closing thoughts: write the follow-ups tonight while the hallway conversations are still fresh.',
    source: 'typed',
    topic: 'accessibility',
    created_at: '2026-11-12T15:05:00-07:00',
  },
];

export const SEED_PEOPLE: SeedPerson[] = [
  {
    client_id: '00000000-0000-4000-8000-200000000001',
    name: 'Marcus Okafor',
    context: 'OpenTelemetry collector maintainer, met at the booth',
  },
  {
    client_id: '00000000-0000-4000-8000-200000000002',
    name: 'Priya Raman',
    context: 'Speaker on sidecar-less mesh migration',
  },
  {
    client_id: '00000000-0000-4000-8000-200000000003',
    name: 'Lena Vasquez',
    context: 'Accessibility working group lead',
  },
  {
    client_id: '00000000-0000-4000-8000-200000000004',
    name: 'Dev Chen',
    context: 'Screen reader demo, Kubernetes dashboards',
  },
];

export const SEED_PROMISES: SeedPromise[] = [
  {
    client_id: '00000000-0000-4000-8000-300000000001',
    text: 'Send Marcus my span filtering question and a sample trace',
    person_client_id: '00000000-0000-4000-8000-200000000001',
    due: '2026-11-12',
    done: false,
  },
  {
    client_id: '00000000-0000-4000-8000-300000000002',
    text: 'Email Priya the migration questions from the mesh keynote',
    person_client_id: '00000000-0000-4000-8000-200000000002',
    due: '2026-11-13',
    done: false,
  },
  {
    client_id: '00000000-0000-4000-8000-300000000003',
    text: 'Share the captions feedback with Lena',
    person_client_id: '00000000-0000-4000-8000-200000000003',
    due: null,
    done: true,
  },
];
