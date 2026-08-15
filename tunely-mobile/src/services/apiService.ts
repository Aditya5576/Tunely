export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE || 'https://jiosaavn-api.adityapatil2348.workers.dev'
).trim();

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  token?: string | null;
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

async function fetchWithTimeout(url: string, options: RequestOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, token, headers, ...rest } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(headers as Record<string, string>),
  };

  if (token && token !== 'guest_token') {
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

    return response.json();
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

    return response.json();
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

    return response.json();
  },

  async delete<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
    const response = await fetchWithTimeout(url, { method: 'DELETE', ...options });

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); } catch {}
      throw new ApiError(`HTTP Error ${response.status}`, response.status, errorData);
    }

    return response.json();
  },
};
