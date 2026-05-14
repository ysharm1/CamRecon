import { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  AuthContext,
  AuthUser,
  TokenResponse,
  getAccessToken,
  getStoredUser,
  setTokens,
  setStoredUser,
  clearTokens,
  decodeToken,
  isTokenExpired,
  refreshAccessToken,
} from './auth';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from stored tokens
  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      if (isTokenExpired(token)) {
        // Try to refresh
        const newToken = await refreshAccessToken();
        if (newToken) {
          const decoded = decodeToken(newToken);
          if (decoded) {
            setUser(decoded);
            setStoredUser(decoded);
          }
        }
      } else {
        // Token is still valid, restore user from storage or decode
        const stored = getStoredUser();
        if (stored) {
          setUser(stored);
        } else {
          const decoded = decodeToken(token);
          if (decoded) {
            setUser(decoded);
            setStoredUser(decoded);
          }
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Set up auto-refresh interval
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      const token = getAccessToken();
      if (token && isTokenExpired(token)) {
        const newToken = await refreshAccessToken();
        if (!newToken) {
          setUser(null);
        }
      }
    }, 60_000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Login failed' }));
      throw new Error(error.message || 'Invalid email or password');
    }

    const data: TokenResponse = await res.json();
    setTokens(data.accessToken, data.refreshToken);

    const decoded = decodeToken(data.accessToken);
    if (decoded) {
      setUser(decoded);
      setStoredUser(decoded);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
