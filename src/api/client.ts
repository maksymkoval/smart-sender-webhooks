import { createApi } from './createApi';
import { getDeviceFingerprint } from './fingerprint';

type Listener = () => void;
const sessionExpiredListeners = new Set<Listener>();

/** Lets the session layer react to an unrecoverable 401 without the API knowing about React. */
export function onSessionExpired(listener: Listener): () => void {
  sessionExpiredListeners.add(listener);
  return () => sessionExpiredListeners.delete(listener);
}

/** App-wide API instance. Tests build their own with `createApi`. */
export const api = createApi({
  baseUrl: window.location.origin,
  getFingerprint: getDeviceFingerprint,
  onSessionExpired: () => sessionExpiredListeners.forEach((listener) => listener()),
});
