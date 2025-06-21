import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinLobby } from '../../services/firebase';
import './JoinLobby.css';

export const JoinLobby = () => {
  const [playerName, setPlayerName] = useState('');
  const [lobbyId, setLobbyId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if lobby ID is provided in URL params
  const urlLobbyId = searchParams.get('lobby');
  
  useState(() => {
    if (urlLobbyId) {
      setLobbyId(urlLobbyId);
    }
  });

  const handleJoinLobby = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!lobbyId.trim()) {
      setError('Please enter a lobby ID');
      return;
    }

    setIsJoining(true);
    setError('');

    try {
      await joinLobby(lobbyId.trim(), playerName.trim());
      // Navigate to the lobby as a guest
      navigate(`/lobby/${lobbyId.trim()}`);
    } catch (error: any) {
      console.error('Error joining lobby:', error);
      setError(error.message || 'Failed to join lobby. Please check the lobby ID and try again.');
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isJoining) {
      handleJoinLobby();
    }
  };

  return (
    <div className="join-lobby-container">
      <div className="join-lobby-card">
        <h1 className="join-lobby-title">Join Game Lobby</h1>
        <p className="join-lobby-subtitle">
          Enter the lobby details to join the music guessing game
        </p>

        <div className="join-lobby-form">
          <div className="form-group">
            <label htmlFor="playerName" className="form-label">
              Your Name
            </label>
            <input
              id="playerName"
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter your display name"
              className="form-input"
              disabled={isJoining}
              maxLength={30}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="lobbyId" className="form-label">
              Lobby ID
            </label>
            <input
              id="lobbyId"
              type="text"
              value={lobbyId}
              onChange={(e) => setLobbyId(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Enter lobby ID"
              className="form-input"
              disabled={isJoining || !!urlLobbyId}
            />
            {urlLobbyId && (
              <p className="form-hint">
                Lobby ID provided from invitation link
              </p>
            )}
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <button
            onClick={handleJoinLobby}
            disabled={isJoining || !playerName.trim() || !lobbyId.trim()}
            className="join-lobby-btn"
          >
            {isJoining ? (
              <>
                <div className="spinner"></div>
                Joining Lobby...
              </>
            ) : (
              'Join Lobby'
            )}
          </button>

          <div className="join-info">
            <p className="join-text">
              No Spotify account required to join as a player
            </p>
          </div>
        </div>

        <div className="alternative-action">
          <p className="alternative-text">Want to host a game instead?</p>
          <button
            onClick={() => navigate('/create')}
            className="alternative-btn"
            disabled={isJoining}
          >
            Create Lobby
          </button>
        </div>
      </div>
    </div>
  );
}; 