// Automatic Hot-Update & Safari WebKit Cache Eviction Engine
let currentBuildTime = null;

export async function forceSafariCachePurge() {
  console.log("⚡ Forcing Safari & Browser Cache Purge...");

  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    } catch (e) {
      console.warn("Caches purge warning:", e);
    }
  }

  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(r => r.unregister()));
    } catch (e) {
      console.warn("ServiceWorker unregister warning:", e);
    }
  }

  localStorage.removeItem('tunely_active_build');
  const cleanPath = window.location.pathname;
  window.location.href = `${cleanPath}?force_sync=${Date.now()}`;
}

export async function checkAppVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    
    if (!data || !data.buildTime) return;

    if (currentBuildTime === null) {
      currentBuildTime = data.buildTime;
      localStorage.setItem('tunely_active_build', data.buildTime.toString());
      return;
    }

    if (data.buildTime > currentBuildTime) {
      console.log(`🚀 New Tunely Deployment Detected (Build ${data.buildTime}). Bypassing Safari WebKit Cache...`);
      
      currentBuildTime = data.buildTime;
      localStorage.setItem('tunely_active_build', data.buildTime.toString());

      await forceSafariCachePurge();
    }
  } catch (err) {
    // Silent fail if offline
  }
}

export function initVersionChecker() {
  checkAppVersion();
  // Check every 20 seconds
  setInterval(checkAppVersion, 20000);
  // Also check when tab becomes visible or receives focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAppVersion();
    }
  });
  window.addEventListener('focus', checkAppVersion);
}
