import { Track, Album, Playlist } from '../types/music';
import { User } from '../types/user';

export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev'
).trim();

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  token?: string | null;
  adminToken?: string | null;
}

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function fetchWithTimeout(url: string, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, token, adminToken, headers, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (adminToken) {
    requestHeaders['Authorization'] = `AdminBearer ${adminToken}`;
  } else if (token && token !== 'guest_token') {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers: requestHeaders,
      signal: controller.signal,
    });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new ApiError('Request timed out', 408);
    }
    throw new ApiError(error.message || 'Network request failed', 0);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const apiService = {
  async get<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, { method: 'GET', ...options });
    
    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch {}
      throw new ApiError(`HTTP Error ${response.status}`, response.status, errorData);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError('Malformed JSON response from server', response.status);
    }
  },

  async post<T>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch {}
      throw new ApiError(`HTTP Error ${response.status}`, response.status, errorData);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError('Malformed JSON response from server', response.status);
    }
  },

  async put<T>(endpoint: string, body?: any, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      ...options,
    });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch {}
      throw new ApiError(`HTTP Error ${response.status}`, response.status, errorData);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError('Malformed JSON response from server', response.status);
    }
  },

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, { method: 'DELETE', ...options });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch {}
      throw new ApiError(`HTTP Error ${response.status}`, response.status, errorData);
    }

    try {
      return await response.json();
    } catch {
      throw new ApiError('Malformed JSON response from server', response.status);
    }
  },

  // ─── SEARCH ENDPOINTS ────────────────────────────────────────────────────────
  async searchAll(query: string): Promise<{ success: boolean; data: any }> {
    return this.get(`/api/search?query=${encodeURIComponent(query)}`);
  },

  async searchSongs(query: string, page = 0, limit = 20): Promise<{ success: boolean; data: { results: Track[]; total: number } }> {
    return this.get(`/api/search/songs?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  },

  async searchAlbums(query: string, page = 0, limit = 20): Promise<{ success: boolean; data: { results: Album[]; total: number } }> {
    return this.get(`/api/search/albums?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  },

  async searchPlaylists(query: string, page = 0, limit = 20): Promise<{ success: boolean; data: { results: Playlist[]; total: number } }> {
    return this.get(`/api/search/playlists?query=${encodeURIComponent(query)}&page=${page}&limit=${limit}`);
  },

  // ─── MUSIC & DETAIL ENDPOINTS ────────────────────────────────────────────────
  async getSongById(id: string): Promise<{ success: boolean; data: Track[] }> {
    return this.get(`/api/songs/${encodeURIComponent(id)}`);
  },

  async getSongSuggestions(id: string, limit = 10): Promise<{ success: boolean; data: Track[] }> {
    return this.get(`/api/songs/${encodeURIComponent(id)}/suggestions?limit=${limit}`);
  },

  async getAlbumById(id: string): Promise<{ success: boolean; data: Album }> {
    return this.get(`/api/albums?id=${encodeURIComponent(id)}`);
  },

  async getPlaylistById(id: string): Promise<{ success: boolean; data: Playlist }> {
    return this.get(`/api/playlists?id=${encodeURIComponent(id)}`);
  },

  async getHomeModules(language = 'english,hindi'): Promise<{ success: boolean; data: any }> {
    return this.get(`/api/modules?language=${encodeURIComponent(language)}`);
  },

  // ─── AUTHENTICATION ENDPOINTS ────────────────────────────────────────────────
  async register(email: string, name: string, password: string): Promise<{ success: boolean; data: { token: string; user: User } }> {
    return this.post('/api/auth/register', { email, name, password });
  },

  async login(email: string, password: string): Promise<{ success: boolean; data: { token: string; user: User } }> {
    return this.post('/api/auth/login', { email, password });
  },

  async getCurrentUser(token: string): Promise<{ success: boolean; user: User }> {
    return this.get('/api/auth/me', { token });
  },

  async updateProfile(fields: Partial<User>, token: string): Promise<{ success: boolean; user: User }> {
    return this.put('/api/auth/profile', fields, { token });
  },

  // ─── USER SYNC ENDPOINTS ─────────────────────────────────────────────────────
  async syncCustomPlaylists(playlists: any[], localUpdatedAt: string, token: string): Promise<{ success: boolean; data: { playlists: any[]; serverUpdatedAt?: string } }> {
    return this.post('/api/user/playlists/sync', { playlists, localUpdatedAt }, { token });
  },

  async syncLikedSongs(likedSongs: any[], localUpdatedAt: string, token: string): Promise<{ success: boolean; data: { likedSongs: any[]; serverUpdatedAt?: string } }> {
    return this.post('/api/user/liked-songs/sync', { likedSongs, localUpdatedAt }, { token });
  },

  async getBroadcastMessage(token: string): Promise<{ success: boolean; broadcast: { message: string; timestamp: string } | null }> {
    return this.get('/api/user/broadcast', { token });
  },

  // ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────
  async adminLogin(email: string, password: string): Promise<{ success: boolean; token: string }> {
    return this.post('/api/admin/login', { email, password });
  },

  async adminGetUsers(adminToken: string): Promise<{ success: boolean; users: any[] }> {
    return this.get('/api/admin/users', { adminToken });
  },

  async adminBanUser(email: string, isBanned: boolean, adminToken: string): Promise<{ success: boolean; message: string }> {
    return this.post(`/api/admin/users/${encodeURIComponent(email)}/ban`, { isBanned }, { adminToken });
  },

  async adminSendBroadcast(message: string, adminToken: string): Promise<{ success: boolean; broadcast: any }> {
    return this.post('/api/admin/broadcast', { message }, { adminToken });
  },
};
