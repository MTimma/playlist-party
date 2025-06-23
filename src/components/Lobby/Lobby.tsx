import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { subscribeLobby, getCurrentUser, leaveLobby, updateLobbyStatus, createPlaylistCollection } from '../../services/firebase';
import { PlayerList } from './PlayerList';
import type { Lobby as LobbyType } from '../../types/types';
import './Lobby.css';
import { SearchDialog } from '../SearchDialog/SearchDialog';
import { PlaylistStats } from '../PlaylistStats/PlaylistStats';

export const Lobby = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [lobby, setLobby] = useState<LobbyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [copied, setCopied] = useState(false);

  const isHost = searchParams.get('host') === 'true';

  useEffect(() => {
    if (!lobbyId) {
      navigate('/');
      return;
    }

    // Get current user
    const user = getCurrentUser();
    if (user) {
      setCurrentUserId(user.uid);
    }

    // Generate share link
    setShareLink(`${window.location.origin}/join?lobby=${lobbyId}`);

    // Subscribe to lobby updates
    const unsubscribe = subscribeLobby(lobbyId, (lobbyData) => {
      if (lobbyData) {
        setLobby(lobbyData);
        setError('');
      } else {
        setError('Lobby not found');
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [lobbyId, navigate]);

  const handleCopyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleStartSongCollection = async () => {
    if (!lobbyId || !lobby) return;
    
    try {
      // Create a playlist collection document
      await createPlaylistCollection(lobbyId, `playlist_${lobbyId}`);
      
      // Update lobby status to start song collection
      await updateLobbyStatus(lobbyId, 'collecting_songs');
    } catch (error) {
      console.error('Error starting song collection:', error);
      setError('Failed to start song collection. Please try again.');
    }
  };

  const handleGameStart = () => {
    // Navigate to game view (to be implemented in Phase 3)
    navigate(`/game/${lobbyId}`);
  };

  const handleLeaveLobby = async () => {
    if (!lobbyId) return;
    
    try {
      await leaveLobby(lobbyId);
      navigate('/');
    } catch (error) {
      console.error('Error leaving lobby:', error);
    }
  };

  const getStatusMessage = () => {
    if (!lobby) return '';
    
    switch (lobby.status) {
      case 'waiting':
        return 'Waiting for players to join';
      case 'collecting_songs':
        return 'Players are adding songs to the playlist';
      case 'in_progress':
        return 'Game is in progress';
      case 'finished':
        return 'Game has finished';
      default:
        return '';
    }
  };

  const canStartSongCollection = () => {
    if (!lobby || !isHost) return false;
    return lobby.status === 'waiting' && Object.keys(lobby.players).length >= 2;
  };

  if (loading) {
    return (
      <div className="lobby-container">
        <div className="lobby-loading">
          <div className="spinner large"></div>
          <p>Loading lobby...</p>
        </div>
      </div>
    );
  }

  if (error || !lobby) {
    return (
      <div className="lobby-container">
        <div className="lobby-error">
          <h2>Lobby Error</h2>
          <p>{error || 'Lobby not found'}</p>
          <button onClick={() => navigate('/')} className="error-action-btn">
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby-container">
      <div className="lobby-content">
        <div className="lobby-header">
          <div className="lobby-info">
            <h1 className="lobby-title">Game Lobby</h1>
            <div className="lobby-id">
              <span className="lobby-id-label">Lobby ID:</span>
              <code className="lobby-id-value">{lobbyId}</code>
            </div>
            <div className="lobby-status">
              <div className={`status-indicator ${lobby.status}`}></div>
              <span className="status-text">{getStatusMessage()}</span>
            </div>
          </div>

          <div className="lobby-actions">
            {isHost ? (
              <div className="host-actions">
                <button
                  onClick={handleCopyShareLink}
                  className="action-btn secondary"
                >
                  {copied ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      Copied!
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
                      </svg>
                      Copy Invite Link
                    </>
                  )}
                </button>
                
                {canStartSongCollection() && (
                  <button
                    onClick={handleStartSongCollection}
                    className="action-btn primary"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                    Start Song Collection
                  </button>
                )}
              </div>
            ) : (
              <button
                onClick={handleLeaveLobby}
                className="action-btn secondary"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
                </svg>
                Leave Lobby
              </button>
            )}
          </div>
        </div>

        <PlayerList
          players={lobby.players}
          maxPlayers={lobby.maxPlayers}
          currentUserId={currentUserId}
        />

        {isHost && lobby.status === 'waiting' && Object.keys(lobby.players).length < 2 && (
          <div className="waiting-notice">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <div>
              <h3>Waiting for Players</h3>
              <p>You need at least 2 players to start the game. Share the invite link with your friends!</p>
              <div className="share-link-container">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="share-link-input"
                />
                <button
                  onClick={handleCopyShareLink}
                  className="copy-btn"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>
        )}

        {lobby.status === 'collecting_songs' && (
          <div className="collection-phase">
            <h3>Song Collection Phase</h3>
            <p>Players can now add songs to the playlist. The game will start once everyone has added their songs.</p>
            
            {/* Search dialog for all players */}
            <SearchDialog 
              lobbyId={lobbyId!}
              currentUserId={currentUserId}
              isHost={isHost}
            />
            
            {/* Playlist stats for host */}
            {isHost && (
              <PlaylistStats 
                lobbyId={lobbyId!}
                onStartGame={handleGameStart}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}; 