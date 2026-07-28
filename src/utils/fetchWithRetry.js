// Automatic Fetch Wrapper with Exponential Backoff & Retry
// Retries failed API calls up to 3 times before failing gracefully.

export async function fetchWithRetry(url, options = {}, retries = 3, backoffMs = 400) {
  let attempt = 0;
  while (attempt < retries) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;

      // Retrying 5xx server errors
      if (response.status >= 500 && attempt < retries - 1) {
        attempt++;
        await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
        continue;
      }
      return response;
    } catch (err) {
      attempt++;
      if (attempt >= retries) throw err;
      await new Promise(res => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
    }
  }
}
