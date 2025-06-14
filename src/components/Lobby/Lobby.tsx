import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createGame } from '../../services/firebase';
import type { Player } from '../../types';
import './Lobby.css';

export const Lobby = () => {
  const [playerName, setPlayerName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // Handle Spotify OAuth callback
  useEffect(() => {
    if (window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.replace('#', '?'));
      const token = params.get('access_token');
      if (token) {
        setSpotifyToken(token);
        localStorage.setItem('spotify_token', token);
        window.location.hash = '';
      }
    } else {
      const token = localStorage.getItem('spotify_token');
      if (token) setSpotifyToken(token);
    }
  }, []);

  const handleSpotifyLogin = () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    window.location.href = `${backendUrl}/login`;
  };

  const handleCreateGame = async () => {
    if (!playerName.trim() || !spotifyToken) return;
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
      {!spotifyToken ? (
        <button className="lobby-button" onClick={handleSpotifyLogin}>
          Login with Spotify
        </button>
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