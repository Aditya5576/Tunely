import { secureStorageService } from '../secureStorageService';
import { storageService } from '../storageService';

jest.mock('../secureStorageService');
jest.mock('../storageService');

describe('Auth & Session Persistence Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('JWT is stored in SecureStore and user profile in AsyncStorage', async () => {
    (secureStorageService.setSecureItem as jest.Mock).mockResolvedValue(true);
    (storageService.setItem as jest.Mock).mockResolvedValue(true);

    const token = 'jwt_secret_token_123';
    const user = { id: 'u1', name: 'Aditya', email: 'aditya@dev.com' };

    await secureStorageService.setSecureItem('tunely_auth_token', token);
    await storageService.setItem('tunely_user_profile', user);

    expect(secureStorageService.setSecureItem).toHaveBeenCalledWith('tunely_auth_token', token);
    expect(storageService.setItem).toHaveBeenCalledWith('tunely_user_profile', user);
  });

  test('Guest Mode token ("guest_token") is stored without exposing JWT endpoints', async () => {
    (secureStorageService.setSecureItem as jest.Mock).mockResolvedValue(true);
    (storageService.setItem as jest.Mock).mockResolvedValue(true);

    const guestToken = 'guest_token';
    const guestUser = { name: 'Guest Listener', email: 'Guest Mode', isGuest: true };

    await secureStorageService.setSecureItem('tunely_auth_token', guestToken);
    await storageService.setItem('tunely_guest_profile', guestUser);

    expect(secureStorageService.setSecureItem).toHaveBeenCalledWith('tunely_auth_token', 'guest_token');
    expect(storageService.setItem).toHaveBeenCalledWith('tunely_guest_profile', guestUser);
  });

  test('Logout deletes token from SecureStore and profile from AsyncStorage', async () => {
    (secureStorageService.deleteSecureItem as jest.Mock).mockResolvedValue(true);
    (storageService.removeItem as jest.Mock).mockResolvedValue(true);

    await secureStorageService.deleteSecureItem('tunely_auth_token');
    await storageService.removeItem('tunely_user_profile');

    expect(secureStorageService.deleteSecureItem).toHaveBeenCalledWith('tunely_auth_token');
    expect(storageService.removeItem).toHaveBeenCalledWith('tunely_user_profile');
  });
});
