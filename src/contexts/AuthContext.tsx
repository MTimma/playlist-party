import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { verifyHostStatus } from '../services/firebase';
import { getSpotifyUser as backendGetSpotifyUser, BACKEND_URL } from '../services/backend';
import type { SpotifyUser } from '../types/types';
import PremiumRequiredModal from '../components/PremiumRequiredModal/PremiumRequiredModal';

interface AuthContextType {
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  getAccessToken: () => Promise<string | null>;
  getSpotifyUser: () => Promise<SpotifyUser | null>;
  requiresPremium: boolean;
  isHostOfLobby: (lobbyId: string) => Promise<boolean>; // NEW
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [requiresPremium, setRequiresPremium] = useState<boolean>(false);

  useEffect(() => {
    // Check if we have a valid session on mount
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/status`, {
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
    window.location.href = `${BACKEND_URL}/login`;
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
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
      const response = await fetch(`${BACKEND_URL}/auth/token`, {
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

  // After authentication, verify premium status once
  useEffect(() => {
    if (isAuthenticated) {
      (async () => {
        await getSpotifyUser();
      })();
    }
  }, [isAuthenticated]);

  const getSpotifyUser = async (): Promise<SpotifyUser | null> => {
    if (!isAuthenticated) return null;
    
    try {
      const user = await backendGetSpotifyUser();
      // If successful, ensure premium flag is cleared
      setRequiresPremium(false);
      return user;
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'premium_required') {
        setRequiresPremium(true);
      }
      console.error('Error fetching Spotify user:', error);
      return null;
    }
  };
  
  const isHostOfLobby = async (lobbyId: string): Promise<boolean> => {
    return await verifyHostStatus(lobbyId);
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        login,
        logout,
        getAccessToken,
        getSpotifyUser,
        requiresPremium,
        isHostOfLobby,
      }}
    >
      {children}
      {requiresPremium && (
        <PremiumRequiredModal onClose={() => setRequiresPremium(false)} />
      )}
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