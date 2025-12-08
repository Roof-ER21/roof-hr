import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'CONTRACTOR';
  employmentType: 'W2' | 'CONTRACTOR';
  department: string;
  position: string;
  mustChangePassword?: boolean;
  phone?: string | null;
  hireDate?: string;
  profilePhoto?: string;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  // Validate token with server
  const validateToken = async (token: string): Promise<User | null> => {
    try {
      const response = await fetch('/api/auth/validate', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        return userData;
      }
      return null;
    } catch (error) {
      console.error('Token validation failed:', error);
      return null;
    }
  };

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          // Validate token with server
          const validatedUser = await validateToken(token);
          
          if (validatedUser) {
            setUser(validatedUser);
            // Update local storage with fresh data
            localStorage.setItem('user', JSON.stringify(validatedUser));
          } else {
            // Token invalid, clear local storage
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setUser(null);
          }
        } catch (error) {
          // Clear invalid data
          console.error('Auth initialization error:', error);
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          setUser(null);
        }
      }
      
      setIsLoading(false);
      setIsInitialized(true);
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    
    try {
      console.log('Sending login request to /api/auth/login');
      
      // First check if API is reachable
      try {
        const healthCheck = await fetch('/api/health');
        console.log('Health check response:', healthCheck.status);
        if (!healthCheck.ok) {
          console.error('Health check failed, response:', await healthCheck.text());
        }
      } catch (err) {
        console.error('API not reachable:', err);
      }
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      console.log('Login response status:', response.status);

      if (!response.ok) {
        const error = await response.json();
        console.error('Login error response:', error);
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      console.log('Login successful, received user:', data.user);
      
      // Store token and user data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      setUser(data.user);
      
      toast({
        title: 'Welcome back!',
        description: `Successfully signed in as ${data.user.firstName} ${data.user.lastName}`,
      });
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      
      if (token) {
        // Attempt to logout on server
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      // Ignore logout errors - still clear local data
      console.warn('Logout request failed:', error);
    } finally {
      // Always clear local data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setIsLoading(false);
      
      toast({
        title: 'Signed out',
        description: 'You have been successfully signed out',
      });
    }
  };

  // Auto-refresh token every 5 minutes
  useEffect(() => {
    if (!user) return;

    const refreshToken = async () => {
      const token = localStorage.getItem('token');
      if (!token) return;

      try {
        const validatedUser = await validateToken(token);
        if (validatedUser) {
          setUser(validatedUser);
          localStorage.setItem('user', JSON.stringify(validatedUser));
        } else {
          // Token expired, logout
          logout();
        }
      } catch (error) {
        console.error('Token refresh failed:', error);
        logout();
      }
    };

    const interval = setInterval(refreshToken, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, [user]);

  // Handle browser visibility changes to refresh token when tab becomes active
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const validatedUser = await validateToken(token);
            if (validatedUser) {
              setUser(validatedUser);
              localStorage.setItem('user', JSON.stringify(validatedUser));
            } else {
              logout();
            }
          } catch (error) {
            console.error('Token validation on visibility change failed:', error);
            logout();
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user]);

  const value = {
    user,
    login,
    logout,
    isLoading,
    isInitialized,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Demo user creation function for development
export async function createDemoUsers() {
  const demoUsers = [
    {
      email: 'admin@roof-er.com',
      password: 'admin123',
      firstName: 'John',
      lastName: 'Admin',
      role: 'ADMIN',
      employmentType: 'W2',
      department: 'Administration',
      position: 'System Administrator',
      hireDate: '2023-01-01',
    },
    {
      email: 'manager@roof-er.com',
      password: 'manager123',
      firstName: 'Sarah',
      lastName: 'Manager',
      role: 'MANAGER',
      employmentType: 'W2',
      department: 'Operations',
      position: 'General Manager',
      hireDate: '2023-02-01',
    },
    {
      email: 'employee@roof-er.com',
      password: 'employee123',
      firstName: 'Mike',
      lastName: 'Worker',
      role: 'EMPLOYEE',
      employmentType: 'W2',
      department: 'Field Operations',
      position: 'Field Worker',
      hireDate: '2023-03-01',
    },
  ];

  for (const userData of demoUsers) {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      if (response.ok) {
        console.log(`Demo user created: ${userData.email}`);
      } else {
        console.log(`Demo user may already exist: ${userData.email}`);
      }
    } catch (error) {
      console.warn(`Failed to create demo user ${userData.email}:`, error);
    }
  }
}

// Auto-create demo users in development
// Commented out to prevent automatic registration attempts on page load
// if (import.meta.env.DEV) {
//   createDemoUsers();
// }
