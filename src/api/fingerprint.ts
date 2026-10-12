const STORAGE_KEY = 'device_fingerprint';
const FINGERPRINT_PATTERN = /^[0-9a-f]{32}$/;

let cached: string | null = null;

function generateFingerprint(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Stable device identifier: 32 hex chars, generated once and persisted in
 * localStorage. Falls back to an in-memory value if storage is unavailable
 * (e.g. blocked in a private window).
 */
export function getDeviceFingerprint(): string {
  if (cached) return cached;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && FINGERPRINT_PATTERN.test(stored)) {
      cached = stored;
      return stored;
    }
  } catch {
    // Storage is not available — keep the value in memory only.
  }

  const fingerprint = generateFingerprint();
  try {
    localStorage.setItem(STORAGE_KEY, fingerprint);
  } catch {
    // Same as above.
  }
  cached = fingerprint;
  return fingerprint;
}
