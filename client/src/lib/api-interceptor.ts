// Store original fetch before any modifications
const originalFetch = window.fetch;

// API interceptor to handle authentication errors and token refresh
class ApiInterceptor {
  private static instance: ApiInterceptor;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string) => void> = [];

  static getInstance(): ApiInterceptor {
    if (!ApiInterceptor.instance) {
      ApiInterceptor.instance = new ApiInterceptor();
    }
    return ApiInterceptor.instance;
  }

  private addRefreshSubscriber(callback: (token: string) => void) {
    this.refreshSubscribers.push(callback);
  }

  private onRefreshed(token: string) {
    this.refreshSubscribers.forEach(callback => callback(token));
    this.refreshSubscribers = [];
  }

  private onRefreshFailed() {
    this.refreshSubscribers = [];
    // Clear storage and redirect to login
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }

  private async refreshToken(): Promise<string | null> {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;

      // Use original fetch to avoid recursion
      const response = await originalFetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        localStorage.setItem('user', JSON.stringify(userData));
        return token;
      }
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }

  async interceptRequest(url: string, options: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem('token');
    
    if (token) {
      options.headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
      };
    }

    // Use original fetch to avoid recursion
    let response = await originalFetch(url, options);

    // Handle 401 errors with token refresh
    if (response.status === 401 && token) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        
        try {
          const newToken = await this.refreshToken();
          
          if (newToken) {
            this.onRefreshed(newToken);
            this.isRefreshing = false;
            
            // Retry the original request with refreshed token
            options.headers = {
              ...options.headers,
              'Authorization': `Bearer ${newToken}`,
            };
            response = await originalFetch(url, options);
          } else {
            this.onRefreshFailed();
            this.isRefreshing = false;
            return response;
          }
        } catch (error) {
          this.onRefreshFailed();
          this.isRefreshing = false;
          throw error;
        }
      } else {
        // Wait for ongoing refresh to complete
        return new Promise((resolve) => {
          this.addRefreshSubscriber((token) => {
            options.headers = {
              ...options.headers,
              'Authorization': `Bearer ${token}`,
            };
            resolve(originalFetch(url, options));
          });
        });
      }
    }

    return response;
  }
}

export const apiInterceptor = ApiInterceptor.getInstance();

// Override the global fetch with our interceptor
(window as any).fetch = (url: RequestInfo | URL, options?: RequestInit) => {
  if (typeof url === 'string' && url.startsWith('/api/') && !url.includes('/auth/validate')) {
    return apiInterceptor.interceptRequest(url, options);
  }
  return originalFetch(url, options);
};