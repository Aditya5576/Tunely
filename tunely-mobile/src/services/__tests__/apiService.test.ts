import { apiService, ApiError, fetchWithTimeout, API_BASE_URL } from '../apiService';

describe('apiService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global as any).fetch = jest.fn();
  });

  test('API Base URL is defined and points to backend', () => {
    expect(API_BASE_URL).toContain('https://');
  });

  test('GET request formats query properly and parses JSON response', async () => {
    const mockData = { success: true, data: { results: [{ id: '123', name: 'Believer' }] } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => mockData,
    });

    const result = await apiService.searchSongs('Believer');
    expect(result).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/search/songs?query=Believer'),
      expect.objectContaining({ method: 'GET' })
    );
  });

  test('POST request includes json body and returns created resource', async () => {
    const mockResponse = { success: true, data: { token: 'jwt123', user: { id: 'u1', name: 'Aditya', email: 'aditya@dev.com' } } };
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => mockResponse,
    });

    const result = await apiService.register('aditya@dev.com', 'Aditya', 'password123');
    expect(result).toEqual(mockResponse);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'aditya@dev.com', name: 'Aditya', password: 'password123' }),
      })
    );
  });

  test('Authorization header is set when token is passed', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, user: { id: 'u1' } }),
    });

    await apiService.getCurrentUser('valid_jwt_token');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer valid_jwt_token',
        }),
      })
    );
  });

  test('AdminBearer header is set when adminToken is passed', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, users: [] }),
    });

    await apiService.adminGetUsers('admin_token_xyz');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/users'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'AdminBearer admin_token_xyz',
        }),
      })
    );
  });

  test('Handles HTTP 403 Banned user error', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ success: false, message: 'Account is banned' }),
    });

    await expect(apiService.getCurrentUser('banned_token')).rejects.toThrow(ApiError);
  });

  test('Handles network failure gracefully', async () => {
    (global as any).fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(apiService.get('/api/search?query=test')).rejects.toThrow('Failed to fetch');
  });

  test('Handles malformed JSON response without crashing', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    });

    await expect(apiService.get('/api/search?query=test')).rejects.toThrow('Malformed JSON response from server');
  });
});
