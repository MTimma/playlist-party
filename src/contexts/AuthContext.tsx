import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  useEffect(() => {
    // Check if we have a valid session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('http://127.0.0.1:8888/auth/status', {
        credentials: 'include', // Important for cookies
      });
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const login = () => {
    // Redirect to backend login endpoint
    window.location.href = 'http://127.0.0.1:8888/login';
  };

  const logout = async () => {
    try {
      await fetch('http://127.0.0.1:8888/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      setIsAuthenticated(false);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getAccessToken = async (): Promise<string | null> => {
    try {
      const response = await fetch('http://127.0.0.1:8888/auth/token', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to get access token');
      }

      const data = await response.json();
      return data.accessToken;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 