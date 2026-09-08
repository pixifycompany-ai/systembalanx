// Pixify Company - API Configuration

// Base URL for the N8N webhook API
// This should be configured via environment variable in production
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://seu-n8n.com/webhook';

// API request timeout in milliseconds
export const API_TIMEOUT = 30000;

// Default headers for API requests
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
};

/**
 * Generic API fetch function with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...DEFAULT_HEADERS,
        ...options.headers,
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    // Handle API response format
    if (data.success === false) {
      throw new Error(data.error || data.message || 'API request failed');
    }

    return data.data !== undefined ? data.data : data;
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please try again');
      }
      throw error;
    }
    
    throw new Error('An unexpected error occurred');
  }
}

/**
 * GET request helper
 */
export function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' });
}

/**
 * POST request helper
 */
export function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  return apiFetch<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/**
 * DELETE request helper
 */
export function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}
