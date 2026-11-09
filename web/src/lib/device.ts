// Anonymous per-install device id: an opaque UUID v4 in localStorage. No accounts, no personal data.
const KEY = 'kc.deviceId';
let memoryId: string | null = null;

function uuidv4(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = new Uint8Array(16);
  if (c) c.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** Returns the device id, creating it on first use. Falls back to an in-memory id if storage throws. */
export function getDeviceId(): string {
  if (memoryId) return memoryId;
  try {
    const stored = globalThis.localStorage.getItem(KEY);
    if (stored) {
      memoryId = stored;
      return stored;
    }
    const fresh = uuidv4();
    globalThis.localStorage.setItem(KEY, fresh);
    memoryId = fresh;
    return fresh;
  } catch {
    memoryId = memoryId ?? uuidv4();
    return memoryId;
  }
}

/** Test helper: forget the cached id. */
export function resetDeviceIdCacheForTests(): void {
  memoryId = null;
}
