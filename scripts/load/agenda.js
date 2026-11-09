// Bounded k6 load for the backup chaos demo: 50 VUs, 60 s, GET agenda and sessions only.
// Run from a laptop:  k6 run -e BASE_URL=https://<host> scripts/load/agenda.js
// Never targets /api/translate or any LLM route (see guard.js). Not run in CI.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { guardPaths } from './guard.js';

const BASE_URL = (__ENV.BASE_URL || '').replace(/\/+$/, '');
const PATHS = guardPaths((__ENV.PATHS || '/api/agenda,/api/sessions').split(',').map((s) => s.trim()).filter(Boolean));

if (!/^https?:\/\//.test(BASE_URL)) {
  throw new Error('BASE_URL is required, e.g. -e BASE_URL=http://localhost:3108');
}

export const options = {
  vus: 50,
  duration: '60s',
  gracefulStop: '5s',
  thresholds: { http_req_failed: ['rate<0.5'] },
};

export default function () {
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const res = http.get(BASE_URL + path, { headers: { 'x-device-id': 'load-' + __VU } });
  check(res, { 'status < 500': (r) => r.status < 500 });
  sleep(0.2 + Math.random() * 0.3);
}
