import { getAccessToken, isTokenExpired, refreshAccessToken, clearTokens } from './auth';

/**
 * Typed error class for API responses.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip adding the Authorization header */
  noAuth?: boolean;
}

/**
 * Typed fetch wrapper that:
 * - Adds Authorization: Bearer <token> header automatically
 * - Handles 401 responses by attempting token refresh
 * - Throws typed ApiError on failure
 */
export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, noAuth, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    ...(customHeaders as Record<string, string>),
  };

  // Add content-type for JSON bodies
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  // Add auth token
  if (!noAuth) {
    let token = getAccessToken();

    // If token is expired, try to refresh before making the request
    if (token && isTokenExpired(token)) {
      token = await refreshAccessToken();
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    ...rest,
    headers,
    body: body instanceof FormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  };

  const url = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  let res = await fetch(url, config);

  // Handle 401 — attempt token refresh and retry once
  if (res.status === 401 && !noAuth) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...config, headers });
    } else {
      clearTokens();
      // Redirect to login
      window.location.href = '/login';
      throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Please log in again.');
    }
  }

  // Handle non-OK responses
  if (!res.ok) {
    let errorData: { code?: string; message?: string } = {};
    try {
      errorData = await res.json();
    } catch {
      // Response body isn't JSON
    }
    throw new ApiError(
      res.status,
      errorData.code || 'UNKNOWN_ERROR',
      errorData.message || `Request failed with status ${res.status}`,
    );
  }

  // Handle 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Convenience methods
export const api = {
  get<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'POST', body });
  },

  put<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'PUT', body });
  },

  patch<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'PATCH', body });
  },

  delete<T = unknown>(endpoint: string, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'DELETE' });
  },

  /**
   * Upload a file using FormData (skips JSON content-type).
   */
  upload<T = unknown>(endpoint: string, formData: FormData, options?: RequestOptions): Promise<T> {
    return apiClient<T>(endpoint, { ...options, method: 'POST', body: formData });
  },
};
