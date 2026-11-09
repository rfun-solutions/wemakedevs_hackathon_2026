// Mock Sessionize upstream (no dependencies). Env: FIXTURE (default sessionize-v1),
// MODE (ok | 429), PORT (default 4010). In mode 429 the first two requests get
// 429 with Retry-After: 1, later ones are served normally.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(here, '../fixtures');

export function createServer({ fixture = 'sessionize-v1', mode = 'ok' } = {}) {
  if (!/^[a-z0-9-]+$/.test(fixture)) throw new Error(`invalid fixture name: ${fixture}`);
  const body = fs.readFileSync(path.join(FIXTURES_DIR, `${fixture}.json`), 'utf8');
  let count = 0;
  return http.createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200).end('ok');
      return;
    }
    count += 1;
    if (mode === '429' && count <= 2) {
      res.writeHead(429, { 'Retry-After': '1', 'Content-Type': 'text/plain' }).end('rate limited');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(body);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4010);
  createServer({ fixture: process.env.FIXTURE || 'sessionize-v1', mode: process.env.MODE || 'ok' }).listen(port, () =>
    console.log(`mock-upstream listening on ${port} fixture=${process.env.FIXTURE || 'sessionize-v1'} mode=${process.env.MODE || 'ok'}`),
  );
}
