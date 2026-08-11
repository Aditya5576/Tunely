// Automatic Hot-Update Version Checker for Tunely Deployments
let currentBuildTime = null;

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
      console.log(`🚀 New Tunely Deployment Detected (Build ${data.buildTime}). Auto-updating app...`);
      
      // Clear stale service worker & cache storage if present
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        } catch {}
      }

      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map(r => r.unregister()));
        } catch {}
      }

      currentBuildTime = data.buildTime;
      localStorage.setItem('tunely_active_build', data.buildTime.toString());

      // Seamlessly reload to immediate live deployment
      window.location.reload();
    }
  } catch (err) {
    // Silent fail if offline
  }
}

export function initVersionChecker() {
  checkAppVersion();
  // Check every 30 seconds
  setInterval(checkAppVersion, 30000);
  // Also check when tab becomes visible or receives focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkAppVersion();
    }
  });
  window.addEventListener('focus', checkAppVersion);
}
