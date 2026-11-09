// Refuses LLM-cost paths before any traffic. Shared by agenda.js (k6) and its unit test.
const FORBIDDEN = ['llm', 'translate', 'thread'];
const ALLOWED_PREFIXES = ['/api/agenda', '/api/sessions'];

export function guardPath(path) {
  const p = String(path).toLowerCase();
  for (const word of FORBIDDEN) {
    if (p.includes(word)) throw new Error('load guard: path "' + path + '" contains forbidden "' + word + '"');
  }
  if (!ALLOWED_PREFIXES.some((a) => p === a || p.startsWith(a + '/') || p.startsWith(a + '?'))) {
    throw new Error('load guard: path "' + path + '" is not an allowed load target (agenda and sessions only)');
  }
  return path;
}

export function guardPaths(paths) {
  return paths.map(guardPath);
}
