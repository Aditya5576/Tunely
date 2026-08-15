import AsyncStorage from '@react-native-async-storage/async-storage';
import { storageService } from '../storageService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

describe('storageService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('getItem returns parsed JSON when key exists', async () => {
    const mockData = [{ id: 'p1', name: 'My Chill Vibe', songs: [] }];
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockData));

    const result = await storageService.getItem('spotify_custom_playlists', []);
    expect(result).toEqual(mockData);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('spotify_custom_playlists');
  });

  test('getItem returns fallback value when key is missing', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    const result = await storageService.getItem('spotify_custom_playlists', []);
    expect(result).toEqual([]);
  });

  test('getItem returns fallback when JSON is corrupted without throwing error', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('{{INVALID_CORRUPTED_JSON}}');

    const result = await storageService.getItem('spotify_custom_playlists', []);
    expect(result).toEqual([]);
  });

  test('setItem serializes data to JSON properly', async () => {
    (AsyncStorage.setItem as jest.Mock).mockResolvedValueOnce(undefined);

    const playlists = [{ id: 'p1', name: 'Pop Hits' }];
    const success = await storageService.setItem('spotify_custom_playlists', playlists);

    expect(success).toBe(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('spotify_custom_playlists', JSON.stringify(playlists));
  });

  test('removeItem deletes key from AsyncStorage', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValueOnce(undefined);

    const success = await storageService.removeItem('tunely_liked_songs');
    expect(success).toBe(true);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('tunely_liked_songs');
  });
});
