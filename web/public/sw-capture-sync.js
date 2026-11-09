// Background Sync replay for the capture queue (tag kc-capture-flush). Classic script, loaded by sw.js
// with importScripts and by unit tests as text. Mirrors web/src/lib/capture/queue-core.ts toRequest():
// same IndexedDB ('kc-capture' / 'queue'), same wire format. The page and worker may both post an item;
// the server is idempotent on (device_id, client_id), so that is safe.
function kcCaptureRequest(item) {
  var kind = item.kind || 'note';
  var extra = item.extra || {};
  var k;
  var body;
  var path;
  if (kind === 'person') {
    path = '/api/people';
    body = { client_id: item.client_id, name: item.body };
    for (k in extra) body[k] = extra[k];
  } else if (kind === 'promise') {
    path = '/api/promises';
    body = { client_id: item.client_id, text: item.body };
    for (k in extra) body[k] = extra[k];
  } else {
    path = '/api/notes';
    body = {
      client_id: item.client_id,
      body: item.body,
      source: item.source,
      created_at: item.created_at,
    };
    if (item.session_id) body.session_id = item.session_id;
  }
  return { path: path, body: body };
}

function kcCaptureOpen(idb) {
  return new Promise(function (resolve, reject) {
    var open = idb.open('kc-capture');
    open.onupgradeneeded = function () {
      if (!open.result.objectStoreNames.contains('queue')) open.result.createObjectStore('queue');
    };
    open.onsuccess = function () {
      resolve(open.result);
    };
    open.onerror = function () {
      reject(open.error);
    };
  });
}

function kcCaptureReq(req) {
  return new Promise(function (resolve, reject) {
    req.onsuccess = function () {
      resolve(req.result);
    };
    req.onerror = function () {
      reject(req.error);
    };
  });
}

/**
 * Posts pending items oldest first. Resolves with the number synced. Rejects when an item must be
 * retried (network error, 5xx, 429) so the browser reschedules the sync. Other 4xx items are left
 * for the page to show as "Needs attention".
 */
function kcCaptureFlush(idb, fetchFn) {
  return kcCaptureOpen(idb).then(function (db) {
    return kcCaptureReq(db.transaction('queue', 'readonly').objectStore('queue').getAll()).then(
      function (items) {
        var pending = items
          .filter(function (i) {
            return i.status === 'pending' && i.device_id;
          })
          .sort(function (a, b) {
            return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
          });
        var synced = 0;
        return pending
          .reduce(function (chain, item) {
            return chain.then(function () {
              var r = kcCaptureRequest(item);
              return fetchFn(r.path, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Device-Id': item.device_id,
                  'X-Capture-Saved-Ms': String(item.saved_ms || 0),
                },
                body: JSON.stringify(r.body),
              }).then(function (res) {
                if (res.status >= 200 && res.status < 300) {
                  synced++;
                  return kcCaptureReq(
                    db
                      .transaction('queue', 'readwrite')
                      .objectStore('queue')
                      .delete(item.client_id),
                  );
                }
                if (res.status === 429 || res.status >= 500) {
                  throw new Error('retry: HTTP ' + res.status);
                }
                // other 4xx: leave it; the page marks it needs_attention on its next flush
              });
            });
          }, Promise.resolve())
          .then(function () {
            db.close();
            return synced;
          });
      },
    );
  });
}
