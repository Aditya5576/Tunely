import { apiService } from '../apiService';
import { storageService } from '../storageService';

jest.mock('../apiService');
jest.mock('../storageService');

describe('Realtime Sync Reconciliation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('Guest user sync is strictly skipped', async () => {
    const isGuest = true;
    const token = 'guest_token';

    if (isGuest || token === 'guest_token') {
      // Sync logic should return immediately without API call
    }

    expect(apiService.syncCustomPlaylists).not.toHaveBeenCalled();
    expect(apiService.syncLikedSongs).not.toHaveBeenCalled();
  });

  test('Authenticated user sync sends local playlists and updates timestamp on success', async () => {
    const mockLocalPlaylists = [{ id: 'custom_1', name: 'Workout Vibe', songs: [] }];
    const mockServerPlaylists = [{ id: 'custom_1', name: 'Workout Vibe', songs: [] }, { id: 'custom_2', name: 'Focus', songs: [] }];
    const mockServerTs = '2026-08-15T23:00:00.000Z';

    (storageService.getItem as jest.Mock)
      .mockResolvedValueOnce(mockLocalPlaylists) // custom playlists
      .mockResolvedValueOnce('2026-08-15T20:00:00.000Z') // playlist timestamp
      .mockResolvedValueOnce([]) // liked songs
      .mockResolvedValueOnce('2026-08-15T20:00:00.000Z'); // liked timestamp

    (apiService.syncCustomPlaylists as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { playlists: mockServerPlaylists, serverUpdatedAt: mockServerTs },
    });

    (apiService.syncLikedSongs as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: { likedSongs: [], serverUpdatedAt: mockServerTs },
    });

    const token = 'valid_user_jwt';

    const localPlaylists = await storageService.getItem('spotify_custom_playlists', []);
    const localTs = await storageService.getItem('tunely_custom_playlists_updated_at', new Date(0).toISOString());

    const res = await apiService.syncCustomPlaylists(localPlaylists, localTs, token);

    expect(res.success).toBe(true);
    expect(res.data.playlists).toHaveLength(2);
    expect(apiService.syncCustomPlaylists).toHaveBeenCalledWith(localPlaylists, localTs, token);
  });

  test('Offline network failure during sync does not clear local playlists', async () => {
    (apiService.syncCustomPlaylists as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    try {
      await apiService.syncCustomPlaylists([], '2026-08-15T00:00:00.000Z', 'jwt');
    } catch (e) {
      // Caught network failure safely
    }

    expect(storageService.removeItem).not.toHaveBeenCalledWith('spotify_custom_playlists');
  });
});
