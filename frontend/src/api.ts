export const API_BASE_URL = 'http://localhost:8000';

export interface ApiRequestOptions extends RequestInit {
  requiresAuth?: boolean;
}

export async function apiRequest<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { requiresAuth = true, ...initOptions } = options;
  
  const headers = new Headers(initOptions.headers || {});
  
  // Automatically inject JWT token from localStorage if required
  if (requiresAuth) {
    const token = localStorage.getItem('edupilot_token');
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    } else {
      // If no token exists and endpoint requires auth, redirect to login
      window.dispatchEvent(new CustomEvent('unauthorized'));
    }
  }

  // Ensure Content-Type is application/json if sending JSON body
  if (initOptions.body && !(initOptions.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...initOptions,
    headers
  });

  if (response.status === 401 && requiresAuth) {
    // Dispatch unauthorized event to trigger logout / redirect
    localStorage.removeItem('edupilot_token');
    localStorage.removeItem('edupilot_username');
    window.dispatchEvent(new CustomEvent('unauthorized'));
    throw new Error('Session expired, please login again.');
  }

  if (!response.ok) {
    let errorDetail = 'An error occurred';
    try {
      const errorJson = await response.json();
      errorDetail = errorJson.detail || errorDetail;
    } catch (e) {
      // Fail silently and use status text or default
      errorDetail = response.statusText || errorDetail;
    }
    throw new Error(errorDetail);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return null as any;
  }

  return response.json();
}
