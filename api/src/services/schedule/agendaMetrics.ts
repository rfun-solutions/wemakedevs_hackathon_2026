import { metrics, trace } from '@opentelemetry/api';

export const tracer = trace.getTracer('kubecompanion');
const meter = metrics.getMeter('kubecompanion');

// SLO candidate (F owns the rule): kc_agenda_request_ms p95 < 400 ms.
export const agendaRequestMs = meter.createHistogram('kc_agenda_request_ms', {
  unit: 'ms',
  description: 'Handler latency of GET /api/agenda',
});
export const agendaDbQueries = meter.createHistogram('kc_agenda_db_queries', {
  description: 'Database queries per GET /api/agenda request',
});
export const agendaItems = meter.createUpDownCounter('kc_agenda_items', {
  description: 'Agenda items added minus removed (all devices, this process)',
});
