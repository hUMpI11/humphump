import { useRef } from 'react';

/**
 * Verhindert Doppelspeichern: Auf einem trägen Handy wird „Speichern“ gern zweimal
 * getippt – ohne Sperre stünde der Eintrag dann doppelt im Stundenzettel.
 */
export function useLock() {
  const busy = useRef(false);
  return async (fn: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await fn();
    } finally {
      busy.current = false;
    }
  };
}
