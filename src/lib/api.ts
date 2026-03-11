/**
 * Centralized API client with timeout, retries, and consistent error handling.
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'https://schiiphaalayn.com.ng/api';

const DEFAULT_TIMEOUT = 15_000; // 15 seconds
const MAX_RETRIES = 2;
const RETRY_DELAY = 1_000; // 1 second

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  timeout?: number;
  retries?: number;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Core request function. Handles JSON serialization, timeouts, retries (GET only), and error normalization.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ success: boolean; message: string; data: T }> {
  const {
    body,
    timeout = DEFAULT_TIMEOUT,
    retries = MAX_RETRIES,
    headers: customHeaders,
    ...rest
  } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const init: RequestInit = {
    ...rest,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };

  const isIdempotent = !init.method || init.method === 'GET';
  const maxAttempts = isIdempotent ? retries + 1 : 1;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(RETRY_DELAY * attempt);
      }

      const response = await fetchWithTimeout(url, init, timeout);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new ApiError(
          data?.message || `Request failed (${response.status})`,
          response.status,
          data
        );
      }

      return data as { success: boolean; message: string; data: T };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = new ApiError('Request timed out. Please try again.', 408);
        break; // Don't retry timeouts
      }

      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error; // Don't retry client errors
      }
    }
  }

  // All retries exhausted
  if (lastError instanceof ApiError) throw lastError;
  throw new ApiError(
    'Network error. Please check your connection.',
    0,
    lastError
  );
}

/** Convenience GET */
export function apiGet<T = unknown>(endpoint: string, options?: RequestOptions) {
  return apiRequest<T>(endpoint, { ...options, method: 'GET' });
}

/** Convenience POST */
export function apiPost<T = unknown>(endpoint: string, body?: unknown, options?: RequestOptions) {
  return apiRequest<T>(endpoint, { ...options, method: 'POST', body });
}
