// Consent to download the Whisper model (about 117 MB). Kept in localStorage; storage may be unavailable.
const KEY = 'kc.captions.whisperConsent';
export const MODEL_SIZE_MB = 117;

export function hasWhisperConsent(storage?: Pick<Storage, 'getItem'>): boolean {
  try {
    return (storage ?? globalThis.localStorage).getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function setWhisperConsent(storage?: Pick<Storage, 'setItem'>): void {
  try {
    (storage ?? globalThis.localStorage).setItem(KEY, '1');
  } catch {
    /* consent is just not remembered */
  }
}
