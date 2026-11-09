/* global process, console, fetch, URL, AbortSignal */
// Usage: node feed-contract/scripts/validate-feed.mjs <url>
// Fetches the feed and validates it against the v1 schema; exit 1 names the drift.
import fs from 'node:fs';
import Ajv from 'ajv';

const url = process.argv[2] || 'http://127.0.0.1:4010/feed';
const schema = JSON.parse(fs.readFileSync(new URL('../../api/src/services/sessionize/schema.json', import.meta.url), 'utf8'));
const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
if (!res.ok) {
  console.error(`feed-contract: ${url} returned HTTP ${res.status}`);
  process.exit(1);
}
const validate = new Ajv({ allErrors: true }).compile(schema);
const feed = await res.json();
if (!validate(feed)) {
  const seen = new Set();
  for (const e of validate.errors) {
    const extra = e.params?.additionalProperty ? ` (unexpected: ${e.params.additionalProperty})` : e.params?.missingProperty ? ` (missing: ${e.params.missingProperty})` : '';
    const line = `${e.instancePath.replace(/\/\d+/g, '/*') || '/'} ${e.message}${extra}`;
    if (!seen.has(line)) { seen.add(line); console.error(`feed-contract: ${line}`); }
  }
  process.exit(1);
}
console.log(`feed-contract: ${feed.sessions.length} sessions match the v1 schema`);
