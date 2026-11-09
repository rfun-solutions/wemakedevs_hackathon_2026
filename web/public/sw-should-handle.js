// Pure routing predicate shared by sw.js (importScripts) and the unit test (loaded as text).
// Same origin only; never /api/*; never *.dash0.com (telemetry must not be cached, queued or delayed).
function shouldHandle(url, origin) {
  var u;
  try {
    u = new URL(url, origin);
  } catch (e) {
    return false;
  }
  if (u.origin !== origin) return false;
  if (u.hostname === 'dash0.com' || u.hostname.slice(-10) === '.dash0.com') return false;
  if (u.pathname === '/api' || u.pathname.indexOf('/api/') === 0) return false;
  return true;
}
