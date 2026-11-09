import { useEffect, useState } from 'preact/hooks';
import { onAnnounce } from './announce';

/** Mount once in the app shell. Text is cleared first so repeating a message is announced again. */
export function LiveRegions() {
  const [polite, setPolite] = useState('');
  const [assertive, setAssertive] = useState('');
  useEffect(
    () =>
      onAnnounce((p, text) => {
        const set = p === 'assertive' ? setAssertive : setPolite;
        set('');
        setTimeout(() => set(text), 50);
      }),
    [],
  );
  return (
    <div class="visually-hidden">
      <div aria-live="polite" aria-atomic="true" data-testid="announce-polite">
        {polite}
      </div>
      <div role="alert" aria-live="assertive" aria-atomic="true" data-testid="announce-assertive">
        {assertive}
      </div>
    </div>
  );
}
