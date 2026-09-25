export function getCurrentLocation(options = {}) {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) {
      return resolve(null);
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
      },
      (err) => {
        resolve(null);
      },
      { timeout: 15000, ...options }
    );
  });
}

export function getDeviceSignal() {
  const isMac = /Macintosh/i.test(navigator.userAgent);
  const isTouch = navigator.maxTouchPoints && navigator.maxTouchPoints > 0;
  
  if (isMac && isTouch) {
    return 'touch-mac-desktop-mode';
  }
  return '';
}
