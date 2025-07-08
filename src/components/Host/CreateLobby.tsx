import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createLobby } from '../../services/firebase';
import './CreateLobby.css';

export const CreateLobby = () => {
  const [hostName, setHostName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSpotifyUser();
    }
  }, [isAuthenticated]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/status`, {
        credentials: 'include',
      });
      const data = await response.json();
      setIsAuthenticated(data.isAuthenticated);
    } catch {
      setIsAuthenticated(false);
    }
  };

  const fetchSpotifyUser = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/me`, {
        credentials: 'include',
      });
      const data = await response.json();
      setSpotifyUser(data);
      if (data.display_name && !hostName) {
        setHostName(data.display_name);
      }
    } catch (error) {
      console.error('Error fetching Spotify user:', error);
      setSpotifyUser(null);
    }
  };

  const handleSpotifyLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/login`;
  };

  const handleCreateLobby = async () => {
    if (!hostName.trim() || !isAuthenticated || !spotifyUser) {
      setError('Please ensure you are logged in and have entered a name');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const lobbyId = await createLobby(
        hostName.trim(),
        spotifyUser.id,
        maxPlayers
      );
      
      // Navigate to the lobby (host will be inferred from lobby data)
      navigate(`/lobby/${lobbyId}`);
    } catch (error) {
      console.error('Error creating lobby:', error);
      setError('Failed to create lobby. Please try again.');
      setIsCreating(false);
    }
  };

  const generateShareableLink = () => {
    return `${window.location.origin}/join`;
  };

  if (!isAuthenticated) {
    return (
      <div className="create-lobby-container">
        <div className="create-lobby-card">
          <h1 className="create-lobby-title">Create Game Lobby</h1>
          <p className="create-lobby-subtitle">
            You need to connect your Spotify account to host a game
          </p>
          <button className="spotify-login-btn" onClick={handleSpotifyLogin}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
            </svg>
            Connect Spotify Account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="create-lobby-container">
      <div className="create-lobby-card">
        <h1 className="create-lobby-title">Create Game Lobby</h1>
        
        {spotifyUser && (
          <div className="host-info">
            <div className="host-profile">
              {spotifyUser.images && spotifyUser.images.length > 0 && (
                <img
                  src={spotifyUser.images[0].url}
                  alt="Host profile"
                  className="host-avatar"
                />
              )}
              <div>
                <p className="host-name">Welcome, {spotifyUser.display_name}!</p>
                <p className="host-subtitle">You'll be hosting this game</p>
              </div>
            </div>
          </div>
        )}

        <div className="create-lobby-form">
          <div className="form-group">
            <label htmlFor="hostName" className="form-label">
              Your Display Name
            </label>
            <input
              id="hostName"
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Enter your name"
              className="form-input"
              disabled={isCreating}
              maxLength={30}
            />
          </div>

          <div className="form-group">
            <label htmlFor="maxPlayers" className="form-label">
              Maximum Players
            </label>
            <select
              id="maxPlayers"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
              className="form-select"
              disabled={isCreating}
            >
              <option value={4}>4 Players</option>
              <option value={6}>6 Players</option>
              <option value={8}>8 Players</option>
              <option value={10}>10 Players</option>
            </select>
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            onClick={handleCreateLobby}
            disabled={isCreating || !hostName.trim()}
            className="create-lobby-btn"
          >
            {isCreating ? (
              <>
                <div className="spinner"></div>
                Creating Lobby...
              </>
            ) : (
              'Create Lobby'
            )}
          </button>

          <div className="share-info">
            <p className="share-text">
              Once created, you'll get a shareable link for players to join
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}; 