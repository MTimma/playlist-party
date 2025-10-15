import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { subscribeLobby, signInAnonymouslyIfNeeded, leaveLobby, togglePlayerReady, startGameWithPlaylist } from '../../services/firebase';
import { PlayerList } from './PlayerList';
import { ReadyButton } from '../ReadyButton/ReadyButton';
import { PlaylistNameDialog } from '../PlaylistNameDialog/PlaylistNameDialog';
import { MySongs } from '../MySongs/MySongs';
import type { Lobby as LobbyType } from '../../types/types';
import './Lobby.css';
import { SearchDialog } from '../SearchDialog/SearchDialog';
import { PlaylistStats } from '../PlaylistStats/PlaylistStats';

export const Lobby = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const navigate = useNavigate();
  
  const [lobby, setLobby] = useState<LobbyType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);

  const isHost = lobby && currentUserId && lobby.hostFirebaseUid === currentUserId;

  useEffect(() => {
    if (!lobbyId) {
      navigate('/');
      return;
    }

    const initializeLobby = async () => {
      try {
        // Ensure user is authenticated (sign in anonymously if needed)
        const user = await signInAnonymouslyIfNeeded();
        setCurrentUserId(user.uid);

        // Generate share link
        setShareLink(`${window.location.origin}/join?lobby=${lobbyId}`);

        // Subscribe to lobby updates
        const unsubscribe = subscribeLobby(lobbyId, (lobbyData) => {
          if (lobbyData) {
            // Check if current user is a member of this lobby
            const isUserInLobby = lobbyData.players && user.uid in lobbyData.players;
            
            if (!isUserInLobby) {
              // User is not a member of this lobby, redirect to join page
              console.log('User not in lobby, redirecting to join page');
              navigate(`/join?lobby=${lobbyId}`);
              return;
            }
            
            setLobby(lobbyData);
            setError('');
            
            // Navigate to game when status changes to 'in_progress'
            if (lobbyData.status === 'in_progress') {
              navigate(`/party/${lobbyId}`);
            }
          } else {
            setError('Lobby not found');
          }
          setLoading(false);
        });

        return unsubscribe;
      } catch (error) {
        console.error('Error initializing lobby:', error);
        setError('Failed to join lobby. Please try again.');
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    initializeLobby().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
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

  const handleMobileShare = async () => {
    const shareData = {
      text: `Join the party! ${shareLink}`
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        // Fallback to copy functionality
        await navigator.clipboard.writeText(`Join the party! ${shareLink}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (error) {
      console.error('Failed to share:', error);
      // Fallback to copy functionality on error
      try {
        await navigator.clipboard.writeText(`Join the party! ${shareLink}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (copyError) {
        console.error('Failed to copy as fallback:', copyError);
      }
    }
  };

  const handleToggleReady = async () => {
    if (!lobbyId) return;
    
    try {
      await togglePlayerReady(lobbyId);
    } catch (error) {
      console.error('Error toggling ready status:', error);
      setError('Failed to update ready status. Please try again.');
    }
  };

  const handleStartGameRequest = () => {
    setShowPlaylistDialog(true);
  };

  const handleStartGameConfirm = async (playlistName: string) => {
    if (!lobbyId) return;
    
    try {
      await startGameWithPlaylist(lobbyId, playlistName);
      setShowPlaylistDialog(false);
    } catch (error) {
      console.error('Error starting game:', error);
      setError('Failed to start game. Please try again.');
      setShowPlaylistDialog(false);
    }
  };

  const handleStartGameCancel = () => {
    setShowPlaylistDialog(false);
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

  const getCurrentPlayer = () => {
    if (!lobby || !currentUserId) return null;
    return lobby.players[currentUserId];
  };

  const getAllPlayersReady = () => {
    if (!lobby) return false;
    const players = Object.values(lobby.players);
    return players.length >= 2 && players.every(player => player.isReady === true);
  };

  const getReadyCount = () => {
    if (!lobby) return 0;
    return Object.values(lobby.players).filter(player => player.isReady === true).length;
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

        { isHost && (
          <div className="lobby-header">
          {/* <div className="lobby-info">
            <h1 className="lobby-title">Game Lobby</h1>
            <div className="lobby-id">
              <span className="lobby-id-label">Lobby ID:</span>
              <code className="lobby-id-value">{lobbyId}</code>
            </div>
            <div className="lobby-status">

              <div className={`status-indicator ${lobby.status}`}></div>
              <span className="status-text">{getStatusMessage()}</span>
            </div>
            
          </div> */}

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
                <button
                  onClick={handleMobileShare}
                  className="action-btn secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.50-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92S19.61 16.08 18 16.08z"/>
                  </svg>
                  Share
                </button>
              </div>
            ) : (<>
              {/* // <button
              //   onClick={handleLeaveLobby}
              //   className="action-btn secondary"
              // >
              //   <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              //     <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
              //   </svg>
              //   Leave Lobby
              // </button> */}
            </>)}
          </div>
        </div>)}

        
        {lobby.status === 'collecting_songs' && (<>
            
        
            
            {/* Search dialog for all players */}
            <SearchDialog 
              lobbyId={lobbyId!}
              currentUserId={currentUserId}
            />
            <MySongs 
                lobbyId={lobbyId!}
                userId={currentUserId}
              />
              
            {/* Ready button for all players */}
            {getCurrentPlayer() && (
              <div className="ready-section">
                {!getCurrentPlayer()?.isReady && (
                  <p className="ready-hint">
                    Mark yourself ready once done
                  </p>
                )}
                <ReadyButton
                  isReady={getCurrentPlayer()?.isReady || false}
                  onToggleReady={handleToggleReady}
                />
              </div>
            )}
        <div className="readiness-summary">
              {getReadyCount()} of {Object.keys(lobby.players).length} players ready
        </div>

        <PlayerList
          players={lobby.players}
          maxPlayers={lobby.maxPlayers}
          currentUserId={currentUserId}
        />
      {/* Playlist stats for host */}
      {isHost && (
              <PlaylistStats 
                lobbyId={lobbyId!}
                onStartGame={handleStartGameRequest}
                allPlayersReady={getAllPlayersReady()}
              />
            )}
            
            {/* All players ready notification */}
            {getAllPlayersReady() && isHost && (
              <div className="all-ready-notice">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <div>
                  <h4>All Players Ready!</h4>
                  <p>Everyone has marked themselves ready. You can now start the game.</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Playlist Name Dialog */}
      <PlaylistNameDialog
        isOpen={showPlaylistDialog}
        lobbyId={lobbyId || ''}
        defaultName={lobby?.playlistName}
        onConfirm={handleStartGameConfirm}
        onCancel={handleStartGameCancel}
      />

      
    </div>
  );
}; 