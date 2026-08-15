import { apiService, ApiError, API_BASE_URL } from '../apiService';

describe('apiService Comprehensive Contract Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  test('API Base URL points to backend', () => {
    expect(API_BASE_URL).toContain('https://');
  });

  // ─── SEARCH TESTS ────────────────────────────────────────────────────────────
  test('searchAll queries /api/search', async () => {
    const mockData = { success: true, data: { songs: [], albums: [] } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => mockData,
    });

    const res = await apiService.searchAll('Imagine Dragons');
    expect(res).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search?query=Imagine%20Dragons'),
      expect.anything()
    );
  });

  test('searchSongs includes pagination params', async () => {
    const mockData = { success: true, data: { results: [], total: 0 } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => mockData,
    });

    await apiService.searchSongs('Believer', 1, 15);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/songs?query=Believer&page=1&limit=15'),
      expect.anything()
    );
  });

  test('searchArtists returns artist list', async () => {
    const mockData = { success: true, data: { results: [{ id: 'a1', name: 'Dua Lipa' }], total: 1 } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => mockData,
    });

    const res = await apiService.searchArtists('Dua Lipa');
    expect(res).toEqual(mockData);
  });

  // ─── MUSIC & DETAIL TESTS ────────────────────────────────────────────────────
  test('getSongById fetches song metadata and download URLs', async () => {
    const mockTrack = [{
      id: 'song1',
      name: 'Kesariya',
      duration: 268,
      downloadUrl: [{ quality: '320kbps', url: 'https://aac.saavncdn.com/test.mp4' }],
      image: [{ quality: '500x500', url: 'https://c.saavncdn.com/test.jpg' }]
    }];
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true, data: mockTrack }),
    });

    const res = await apiService.getSongById('song1');
    expect(res.data[0].downloadUrl[0].url).toContain('https://');
  });

  test('getArtistById and getArtistSongs query artist endpoints', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true, data: { name: 'Dua Lipa' } }),
    });

    const artistRes = await apiService.getArtistById('1274170');
    expect(artistRes.success).toBe(true);

    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true, data: [] }),
    });

    const songsRes = await apiService.getArtistSongs('1274170', 0);
    expect(songsRes.success).toBe(true);
  });

  test('getSpotifyPlaylist queries /api/spotify/playlist', async () => {
    const mockPlaylist = { success: true, data: { name: 'Top Hits', tracks: [{ title: 'Levitating', artist: 'Dua Lipa' }] } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => mockPlaylist,
    });

    const res = await apiService.getSpotifyPlaylist('37i9dQZF1DXcBWIGoYBM5M');
    expect(res.data.name).toBe('Top Hits');
  });

  // ─── AUTH & PASSWORD TESTS ───────────────────────────────────────────────────
  test('forgotPassword and resetPassword post to auth endpoint', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true, message: 'OTP sent' }),
    });

    const forgotRes = await apiService.forgotPassword('user@dev.com');
    expect(forgotRes.success).toBe(true);

    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true, message: 'Password reset' }),
    });

    const resetRes = await apiService.resetPassword('user@dev.com', '123456', 'newpass123');
    expect(resetRes.success).toBe(true);
  });

  // ─── USER DATA & LIKED SONGS TESTS ─────────────────────────────────────────
  test('likeSong and unlikeSong send token header and payloads', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true }),
    });

    const song: any = { id: 's1', name: 'Song 1' };
    await apiService.likeSong(song, 'user_token');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/liked'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer user_token' })
      })
    );

    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => ({ success: true }),
    });

    await apiService.unlikeSong('s1', 'user_token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/user/liked'),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  // ─── ERROR HANDLING TESTS (401, 403, 404, 409, 429, 500, TIMEOUT, MALFORMED) ──
  test('Handles HTTP 401 Unauthorized', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 401, json: async () => ({ success: false, message: 'Unauthorized' }),
    });

    await expect(apiService.getCurrentUser('invalid_token')).rejects.toThrow(ApiError);
  });

  test('Handles HTTP 403 Banned user error with status code', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 403, json: async () => ({ success: false, message: 'Account is banned' }),
    });

    try {
      await apiService.getCurrentUser('banned_token');
    } catch (err: any) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(403);
    }
  });

  test('Handles HTTP 404 Not Found', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 404, json: async () => ({ success: false, message: 'Album not found' }),
    });

    try {
      await apiService.getAlbumById('invalid_id');
    } catch (err: any) {
      expect(err.status).toBe(404);
    }
  });

  test('Handles HTTP 409 Conflict for existing email', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 409, json: async () => ({ success: false, message: 'Email already exists' }),
    });

    try {
      await apiService.register('existing@dev.com', 'Name', 'pass123');
    } catch (err: any) {
      expect(err.status).toBe(409);
    }
  });

  test('Handles HTTP 429 Rate Limit error', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 429, json: async () => ({ success: false, message: 'Rate limit exceeded' }),
    });

    try {
      await apiService.getHomeModules();
    } catch (err: any) {
      expect(err.status).toBe(429);
    }
  });

  test('Handles HTTP 500 Internal Server Error', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({ success: false, message: 'Internal error' }),
    });

    try {
      await apiService.getHomeModules();
    } catch (err: any) {
      expect(err.status).toBe(500);
    }
  });

  test('Handles network failure gracefully', async () => {
    (global as any).fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiService.get('/api/search?query=test')).rejects.toThrow('Failed to fetch');
  });

  test('Handles malformed JSON response without crashing', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    });

    await expect(apiService.get('/api/search?query=test')).rejects.toThrow('Malformed JSON response from server');
  });
});
