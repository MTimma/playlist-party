import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinLobby, getCurrentUser } from '../../services/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Lobby } from '../../types/types';
import './JoinLobby.css';

export const JoinLobby = () => {
  const [playerName, setPlayerName] = useState('');
  const [lobbyId, setLobbyId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Check if lobby ID is provided in URL params
  const urlLobbyId = searchParams.get('lobby');
  
  useEffect(() => {
    if (urlLobbyId) {
      setLobbyId(urlLobbyId);
    }
  }, [urlLobbyId]);

  // Check if user is already a member of this lobby
  useEffect(() => {
    const checkExistingMembership = async () => {
      if (!urlLobbyId) {
        setIsChecking(false);
        return;
      }
      
      try {
        const user = getCurrentUser();
        if (!user) {
          setIsChecking(false);
          return;
        }
        
        const lobbyRef = doc(db, 'lobbies', urlLobbyId);
        const lobbyDoc = await getDoc(lobbyRef);
        
        if (lobbyDoc.exists()) {
          const lobby = lobbyDoc.data() as Lobby;
          
          // Check if user is already in this lobby
          if (lobby.players && user.uid in lobby.players) {
            console.log('User already in lobby, redirecting...');
            // Navigate to appropriate page based on lobby status
            if (lobby.status === 'in_progress') {
              navigate(`/party/${urlLobbyId}`);
            } else {
              navigate(`/lobby/${urlLobbyId}`);
            }
            return;
          }
        }
      } catch (error) {
        console.error('Error checking membership:', error);
      }
      
      setIsChecking(false);
    };
    
    checkExistingMembership();
  }, [urlLobbyId, navigate]);

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
    } catch (error) {
      console.error('Error joining lobby:', error);
      setError(error instanceof Error ? error.message : 'Failed to join lobby. Please check the lobby ID and try again.');
      setIsJoining(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isJoining) {
      handleJoinLobby();
    }
  };

  // Show loading while checking membership
  if (isChecking) {
    return (
      <div className="join-lobby-container">
        <div className="join-lobby-card">
          <div className="checking-membership">
            <div className="spinner"></div>
            <p>Checking your membership...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="join-lobby-container">
      <div className="join-lobby-card">
        <h1 className="join-lobby-title">Join the Party!</h1>
        <p className="join-lobby-subtitle">
          Enter the lobby details to join the party
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
              placeholder="Enter your party nickname"
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
                Joining Party...
              </>
            ) : (
              'Join Party'
            )}
          </button>

          <div className="join-info">
            <p className="join-text">
              No Spotify account is required to join
            </p>
          </div>
        </div>

        <div className="alternative-action">
          <p className="alternative-text">Want to host a party instead?</p>
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