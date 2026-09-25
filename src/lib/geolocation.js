/**
 * Browser Geolocation capture for the login form (see pages/Login.jsx).
 * Used by the geo-fencing feature (server/services/accessControlService.js)
 * — the backend is the actual authority on whether a login is allowed; this
 * only gathers the coordinate the login POST can optionally include.
 *
 * Deliberately never throws: on denial, timeout, or an unsupported browser
 * it resolves to `null`, so the login request still gets sent — the server
 * decides what a missing location means for that particular account (an
 * exempt role logs in fine with no location at all; a restricted role with
 * mobile/geo restriction enabled gets a clear "location required" denial
 * instead of the login silently hanging on a frontend promise).
 */
export function getCurrentLocation({ timeout = 8000 } = {}) {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      () => resolve(null), // denied / unavailable / timed out — soft fail, see above
      { enableHighAccuracy: true, timeout, maximumAge: 0 },
    );
  });
}

/**
 * Best-effort "is this actually a touch-primary device pretending to be
 * desktop" signal, sent as an extra header on the login request
 * (X-Device-Signal) for the server to weigh alongside its own
 * User-Agent/Client-Hints classification (server/utils/deviceDetection.js).
 * Like any client-reported value this can be spoofed by a determined
 * attacker tampering with the frontend; it is a supplementary signal, never
 * the backend's sole or primary basis for a decision — the mandatory
 * location requirement (server/services/accessControlService.js, when
 * mobile restriction is enabled) is what actually closes the gap for a
 * device that reports a fake signal here.
 *
 * Covers two known real-world bypasses that plain UA/Client-Hints sniffing
 * cannot see on its own:
 *
 *  - iPadOS: since iPadOS 13, Safari identifies as desktop macOS Safari by
 *    DEFAULT (not only when the user explicitly picks "Request Desktop
 *    Website") — see deviceDetection.js's doc comment. Detected here via
 *    `navigator.platform === 'MacIntel'` combined with multi-touch support,
 *    which a real Mac never has.
 *  - Android: Chrome's "Request Desktop Site" rewrites navigator.userAgent
 *    (and the Sec-CH-UA-Mobile / Sec-CH-UA-Platform Client Hints) to a
 *    generic desktop Linux string, dropping every "Android"/"Mobile" token
 *    the server would otherwise match on. `screen.width`/`screen.height`
 *    are NOT affected by this spoofing (only the layout viewport is), so a
 *    touch-primary device with a physically small screen reporting a
 *    desktop-class UA is a strong tell that this is a phone or small
 *    tablet, not a laptop.
 */
export function getDeviceSignal() {
  try {
    if (typeof navigator === 'undefined') return 'unknown';
    const ua = navigator.userAgent || '';
    const maxTouch = navigator.maxTouchPoints || 0;
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches;

    const isMacPlatform = navigator.platform === 'MacIntel' || /Macintosh/i.test(ua);
    if (isMacPlatform && maxTouch > 1) return 'touch-mac-desktop-mode';

    const screenObj = typeof screen !== 'undefined' ? screen : null;
    const minDimension = screenObj ? Math.min(screenObj.width || 9999, screenObj.height || 9999) : 9999;
    if (coarsePointer && maxTouch > 0 && minDimension > 0 && minDimension <= 500) {
      return 'touch-small-screen';
    }

    if (coarsePointer && maxTouch > 0) return 'touch-primary';
    return 'pointer-primary';
  } catch {
    return 'unknown';
  }
}