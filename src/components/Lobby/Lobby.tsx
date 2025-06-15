import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '../../services/firebase';
import type { Player } from '../../types';
import './Lobby.css';

export const Lobby = () => {
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [spotifyUser, setSpotifyUser] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetch(`${import.meta.env.VITE_BACKEND_URL}/me`, {
        credentials: 'include',
      })
        .then(res => res.json())
        .then(data => setSpotifyUser(data))
        .catch(() => setSpotifyUser(null));
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

  const handleSpotifyLogin = () => {
    window.location.href = `${import.meta.env.VITE_BACKEND_URL}/login`;
  };

  const handleCreateGame = async () => {
    if (!playerName.trim() || !isAuthenticated) return;
    setIsCreating(true);
    try {
      const host: Player = {
        id: crypto.randomUUID(),
        name: playerName,
        isHost: true,
        score: 0
      };
      const newGameId = await createGame(host);
      navigate(`/game/${newGameId}?host=1`);
    } catch (error) {
      console.error('Error creating game:', error);
      setIsCreating(false);
    }
  };

  return (
    <div className="lobby-container">
      <h1 className="text-4xl font-bold mb-8">Music Guessing Game</h1>
      {!isAuthenticated ? (
        <button className="lobby-button" onClick={handleSpotifyLogin}>
          Login with Spotify
        </button>
      ) : spotifyUser ? (
        <div>
          <p>Welcome, {spotifyUser.display_name}!</p>
          {spotifyUser.images && spotifyUser.images.length > 0 && (
            <img
              src={spotifyUser.images[0].url}
              alt="Spotify profile"
              style={{ width: 64, height: 64, borderRadius: '50%', marginBottom: 8 }}
            />
          )}
          {/* You can add a logout button or other UI here */}
        </div>
      ) : (
        <div className="lobby-form">
          <input
            type="text"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="lobby-input"
            disabled={isCreating}
          />
          <button
            onClick={handleCreateGame}
            disabled={isCreating || !playerName.trim()}
            className="lobby-button"
          >
            {isCreating ? 'Creating Game...' : 'Create Game'}
          </button>
        </div>
      )}
    </div>
  );
}; 