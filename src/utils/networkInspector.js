// Network Inspector Utility
// Intercepts all window.fetch calls globally to log, display, and capture network/API errors.

const MAX_LOGS = 50;
const listeners = new Set();
let networkLogs = [];

// Filter helper to prune background sync/polling and optional lyrics lookups
const shouldIgnoreLog = (url) => {
  if (!url) return false;
  const isBackgroundSync = url.includes('/sync') || url.includes('/broadcast');
  const isLyricsLookup = url.includes('/lyrics') || url.includes('lyrics.ovh');
  return isBackgroundSync || isLyricsLookup;
};

// Load existing logs from sessionStorage if available, automatically purging legacy entries
try {
  const saved = sessionStorage.getItem('tunely_network_logs');
  if (saved) {
    const parsed = JSON.parse(saved);
    networkLogs = Array.isArray(parsed) ? parsed.filter(item => !shouldIgnoreLog(item?.url)) : [];
    sessionStorage.setItem('tunely_network_logs', JSON.stringify(networkLogs));
  }
} catch (e) {
  networkLogs = [];
}

const notifyListeners = (latestLog) => {
  listeners.forEach(cb => cb(latestLog, [...networkLogs]));
};

export const subscribeNetworkErrors = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const getNetworkLogs = () => [...networkLogs];

export const clearNetworkLogs = () => {
  networkLogs = [];
  try {
    sessionStorage.removeItem('tunely_network_logs');
  } catch (e) {}
  notifyListeners(null);
};

export const recordNetworkError = (logItem) => {
  // Ignore background sync / polling endpoints and optional lyrics lookups from error inspector logs
  if (shouldIgnoreLog(logItem?.url)) {
    return;
  }

  const fullLog = {
    id: `err_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toLocaleTimeString(),
    ...logItem
  };

  networkLogs = [fullLog, ...networkLogs].slice(0, MAX_LOGS);

  try {
    sessionStorage.setItem('tunely_network_logs', JSON.stringify(networkLogs));
  } catch (e) {}

  notifyListeners(fullLog);
};

// Global Window Fetch Interceptor
if (typeof window !== 'undefined' && !window.__networkInspectorInitialized) {
  window.__networkInspectorInitialized = true;
  const originalFetch = window.fetch;

  window.fetch = async function (...args) {
    const rawUrl = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
    const method = (args[1]?.method || 'GET').toUpperCase();
    const startTime = performance.now();

    try {
      const response = await originalFetch.apply(this, args);
      const duration = Math.round(performance.now() - startTime);

      // Intercept non-OK HTTP responses (4xx, 5xx)
      if (!response.ok) {
        let errorSnippet = '';
        try {
          const clone = response.clone();
          errorSnippet = await clone.text();
          // Try parsing JSON if possible
          try {
            const parsed = JSON.parse(errorSnippet);
            errorSnippet = parsed.message || parsed.error || errorSnippet;
          } catch (e) {}
        } catch (e) {
          errorSnippet = 'Could not read error body';
        }

        recordNetworkError({
          url: rawUrl,
          method,
          status: response.status,
          statusText: response.statusText || `HTTP ${response.status}`,
          error: errorSnippet || `Request failed with status ${response.status}`,
          duration
        });
      }

      return response;
    } catch (err) {
      const duration = Math.round(performance.now() - startTime);
      // Catch network drops, CORS blocks, offline errors
      recordNetworkError({
        url: rawUrl,
        method,
        status: 0,
        statusText: 'Network / Connection Failure',
        error: err?.message || 'Failed to fetch (Check network or CORS)',
        duration
      });
      throw err;
    }
  };
}
