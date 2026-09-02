import { test, expect } from '@playwright/test';

test.describe('Realtime Sync Network Stability Verification', () => {
  test('Monitors network for 45s to prove zero request storms', async ({ page }) => {
    test.setTimeout(60000);
    // 1. Intercept and log all network requests
    const requestCounts = {
      wsTicket: 0,
      playlistSync: 0,
      likedSync: 0,
      broadcast: 0,
      webSockets: 0
    };

    page.on('request', (req) => {
      const url = req.url();
      if (url.includes('/api/auth/ws-ticket')) {
        requestCounts.wsTicket++;
      }
      if (url.includes('/api/user/playlists/sync')) {
        requestCounts.playlistSync++;
      }
      if (url.includes('/api/user/liked/sync') || url.includes('/api/user/liked')) {
        requestCounts.likedSync++;
      }
      if (url.includes('/api/user/broadcast')) {
        requestCounts.broadcast++;
      }
    });

    page.on('websocket', (ws) => {
      requestCounts.webSockets++;
    });

    // Mock authenticated user session
    await page.addInitScript(() => {
      localStorage.setItem('tunely_splash_shown', 'true');
      localStorage.setItem('tunely_auth', JSON.stringify({
        token: 'test_token.1.signature',
        user: { id: 'u_test_123', name: 'Test User', email: 'test@tunely.dev' }
      }));
      localStorage.setItem('spotify_custom_playlists', JSON.stringify([
        { id: 'pl_1', name: 'Favorites', songs: [] }
      ]));
    });

    // Mock the backend endpoints so the frontend operates cleanly
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          user: { id: 'u_test_123', name: 'Test User', email: 'test@tunely.dev', authVersion: 1 }
        })
      });
    });

    await page.route('**/api/auth/ws-ticket', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          ticket: 'valid_single_use_ticket_123'
        })
      });
    });

    await page.route('**/api/user/playlists/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            playlists: [{ id: 'pl_1', name: 'Favorites', songs: [] }],
            serverUpdatedAt: new Date().toISOString()
          }
        })
      });
    });

    await page.route('**/api/user/broadcast', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, broadcast: null })
      });
    });

    await page.goto('/');

    // Wait and observe network traffic for 45 full seconds
    console.log('[Playwright Network Audit] Observing network requests for 45 seconds...');
    await page.waitForTimeout(45000);

    console.log('[Playwright Network Audit Results]:', JSON.stringify(requestCounts, null, 2));

    // Assertions:
    // In Vite dev mode with React StrictMode, initial mount runs twice (wsTicket <= 2). Over 45s, zero looping occurs.
    expect(requestCounts.wsTicket).toBeLessThanOrEqual(2);
    // playlists/sync must be requested at most TWICE (initial load + debounced reconciliation)
    expect(requestCounts.playlistSync).toBeLessThanOrEqual(2);
    // WebSockets opened at most twice (StrictMode dev mount) and zero reconnect storm
    expect(requestCounts.webSockets).toBeLessThanOrEqual(2);
  });
});
