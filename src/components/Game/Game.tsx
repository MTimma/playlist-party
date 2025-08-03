import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  subscribePlaylistCollection, 
  subscribeLobby,
  getCurrentUser,
  signInAnonymouslyIfNeeded,
  subscribeGameResult
} from '../../services/firebase';
import { validateGuess, checkPlayerGuess, endGame } from '../../services/backend';
import { TrackInfo } from '../TrackInfo/TrackInfo';
import { GuessButtons } from '../GuessButtons/GuessButtons';
import { EndGameSummary } from '../EndGameSummary/EndGameSummary';
import type { Track, PlaylistCollection, Lobby, GameResult } from '../../types/types';
import './Game.css';

export const Game = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [playlistCollection, setPlaylistCollection] = useState<PlaylistCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progressMs, setProgressMs] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [hasGuessed, setHasGuessed] = useState<boolean>(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [playerScores, setPlayerScores] = useState<Record<string, number>>({});
  const [isGuessing, setIsGuessing] = useState(false);
  const [lastGuessTime, setLastGuessTime] = useState(0);
  const [currentTrackUri, setCurrentTrackUri] = useState<string | null>(null);
  const [correctlyGuessedTracks, setCorrectlyGuessedTracks] = useState<Record<string, boolean>>({});
  const [guessFeedback, setGuessFeedback] = useState<{ type: 'correct' | 'incorrect'; message: string } | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  
  // Ensure the user is authenticated and keep uid in state
  useEffect(() => {
    let isMounted = true;

    // Attempt to retrieve an existing user or sign in anonymously if needed
    const initAuth = async () => {
      try {
        const user = await signInAnonymouslyIfNeeded();
        if (isMounted) {
          setCurrentUserId(user.uid);
        }
      } catch (err) {
        console.error('Failed to authenticate user:', err);
        // Fallback to currentUser if available
        const existingUser = getCurrentUser();
        if (existingUser && isMounted) {
          setCurrentUserId(existingUser.uid);
        }
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Subscribe to score updates from lobby document with reconciliation
  useEffect(() => {
    if (!lobby?.playerScores) {
      // Initialize empty scores if not available yet
      setPlayerScores({});
      return;
    }
    
    // Trust server scores over local state (reconciliation)
    setPlayerScores(lobby.playerScores);
    
    // Log score updates for debugging
    console.log('Score update received:', lobby.playerScores);
  }, [lobby?.playerScores]);

  // Subscribe to correctly guessed tracks updates
  useEffect(() => {
    if (!lobby?.correctlyGuessedTracks) {
      setCorrectlyGuessedTracks({});
      return;
    }
    
    setCorrectlyGuessedTracks(lobby.correctlyGuessedTracks);
  }, [lobby?.correctlyGuessedTracks]);

  // Auto-end game when all tracks are guessed
  useEffect(() => {
    if (!lobby || !playlistCollection || !lobbyId) return;
    
    // Only host should trigger auto-end to avoid race conditions
    if (lobby.hostFirebaseUid !== currentUserId) return;
    
    const totalTracks = Object.keys(playlistCollection.songs || {}).length;
    const guessedTracks = Object.keys(correctlyGuessedTracks).length;
    
    if (totalTracks > 0 && guessedTracks === totalTracks) {
      console.log('All tracks guessed! Auto-ending game...');
      endGame(lobbyId, true).catch(err => {
        console.error('Failed to auto-end game:', err);
      });
    }
  }, [lobby, playlistCollection, correctlyGuessedTracks, lobbyId, currentUserId]);

  // Check if player has already guessed for the current track - only when track URI changes
  useEffect(() => {
    const checkGuessStatus = async () => {
      if (!lobbyId || !currentUserId || !currentTrackUri) {
        setHasGuessed(false);
        return;
      }

      try {
        const result = await checkPlayerGuess(lobbyId, currentUserId, currentTrackUri);
        setHasGuessed(result.hasGuessed);
      } catch (error) {
        console.error('Error checking guess status:', error);
        setHasGuessed(false);
      }
    };

    checkGuessStatus();
  }, [lobbyId, currentUserId, currentTrackUri]);

  // Subscribe to lobby (now contains game state AND playback state)
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribeLobby(lobbyId, (lobbyData) => {
      setLobby(lobbyData);
      
      if (lobbyData && lobbyData.status === 'in_progress') {
        setLoading(false);
      }
      
      // Handle playback state from Firebase real-time updates
      if (lobbyData) {
        console.log('Firebase playback update:', {
          isPlaying: lobbyData.isPlaying,
          hasCurrentTrack: !!lobbyData.currentTrack,
          trackName: lobbyData.currentTrack?.name,
          progressMs: lobbyData.progressMs
        });
        
        if (lobbyData.isPlaying && lobbyData.currentTrack) {
          const incomingTrackData = lobbyData.currentTrack;
          const incomingUri = incomingTrackData.uri;
          
          // Only update track state if URI actually changed
          if (currentTrackUri !== incomingUri) {
            setCurrentTrackUri(incomingUri);
            setCurrentTrack({
              uri: incomingUri,
              name: incomingTrackData.name,
              artists: incomingTrackData.artists,
              duration_ms: incomingTrackData.duration_ms,
              album: {
                name: incomingTrackData.album.name,
                images: incomingTrackData.album.images
              }
            } as Track);
            // Reset guess status and feedback when track changes
            setHasGuessed(false);
            setGuessFeedback(null);
          }
          
          setIsPlaying(true);
          setProgressMs(lobbyData.progressMs || 0);
          setLastUpdated(new Date());
        } else {
          setIsPlaying(false);
          if (currentTrackUri !== null) {
            setCurrentTrackUri(null);
            setCurrentTrack(null);
          }
          setProgressMs(0);
          setLastUpdated(new Date());
          // Reset feedback when playback stops
          setGuessFeedback(null);
        }
      }
    });
    
    return () => unsubscribe();
  }, [lobbyId, currentTrackUri]);

  // Subscribe to playlist collection to get track info
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      setPlaylistCollection(collection);
    });
    
    return () => unsubscribe();
  }, [lobbyId]);

  // Subscribe to game result document (after lobby deletion)
  useEffect(() => {
    if (!lobbyId) return;
    const unsub = subscribeGameResult(lobbyId, (res) => setGameResult(res));
    return () => unsub();
  }, [lobbyId]);

  const handleEndGameClick = async () => {
    if (!lobbyId) return;
    if (!window.confirm('End the game for all players?')) return;
    try {
      await endGame(lobbyId);
    } catch (err: any) {
      alert(err.message || 'Failed to end game');
    }
  };

  // Helper function to get track owner (needed for guessing game)
  const getTrackOwner = (trackUri: string): string | null => {
    if (!playlistCollection) return null;
    return playlistCollection.songs[trackUri]?.addedBy || null;
  };

  const handleGuess = async (guessedOwnerId: string): Promise<{ isCorrect: boolean; correctOwnerId?: string; correctOwnerName?: string; scoreChange: number }> => {
    if (!lobbyId || !currentUserId || !currentTrack) {
      throw new Error('Missing required data for guess');
    }

    // Implement debouncing to prevent spam clicking
    const now = Date.now();
    if (isGuessing || now - lastGuessTime < 2000) {
      console.log('Guess blocked: too recent or already guessing');
      throw new Error('Please wait before guessing again');
    }

    setIsGuessing(true);
    setLastGuessTime(now);
    
    try {
      // Retry logic for network failures
      const maxRetries = 3;
      let retryCount = 0;
      
      while (retryCount < maxRetries) {
        try {
          const result = await validateGuess(lobbyId, currentUserId, currentTrack.uri, guessedOwnerId);
          setHasGuessed(true);
          
          // Show feedback to user
          if (result.isCorrect) {
            setGuessFeedback({ 
              type: 'correct', 
              message: `You guessed correctly! +${result.scoreChange} point${result.scoreChange !== 1 ? 's' : ''}!` 
            });
            // Mark track as solved locally (will be reconciled by server)
            setCorrectlyGuessedTracks(prev => ({
              ...prev,
              [currentTrack.uri]: true
            }));
          } else {
            setGuessFeedback({ 
              type: 'incorrect', 
              message: `Oh no, that doesn't look correct! ${result.scoreChange} point${Math.abs(result.scoreChange) !== 1 ? 's' : ''}!` 
            });
          }
          
          // Clear feedback after 4 seconds
          setTimeout(() => setGuessFeedback(null), 4000);
          
          return result;
        } catch (error) {
          retryCount++;
          console.error(`Guess submission attempt ${retryCount} failed:`, error);
          
          // Handle specific business logic errors that shouldn't be retried
          if (error instanceof Error && (
            error.message.includes('Track already correctly guessed') ||
            error.message.includes('Already guessed for this track')
          )) {
            // Update local state to reflect the server state
            if (error.message.includes('Track already correctly guessed')) {
              setCorrectlyGuessedTracks(prev => ({
                ...prev,
                [currentTrack.uri]: true
              }));
            }
            if (error.message.includes('Already guessed for this track')) {
              setHasGuessed(true);
            }
            throw error;
          }
          
          // If it's a network error and we have retries left, wait and retry
          if (retryCount < maxRetries && (
            error instanceof TypeError || // Network error
            (error instanceof Error && error.message.includes('Failed to fetch'))
          )) {
            console.log(`Retrying guess submission in ${retryCount * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
            continue;
          }
          
          // If it's a business logic error or we're out of retries, throw immediately
          throw error;
        }
      }
      
      // This should never be reached, but TypeScript requires it
      throw new Error('Failed to submit guess after maximum retries');
    } finally {
      setIsGuessing(false);
    }
  };

  // Handle loading state
  if (loading) {
    return (
      <div className="game-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading game...</p>
        </div>
      </div>
    );
  }

  // Handle lobby terminated by host
  if (lobby && lobby.status === 'terminated_by_host') {
    return (
      <div className="game-container">
        <div className="waiting">
          <h2>Game ended</h2>
          <p>The host has ended this game (or started a new one)</p>
          <Link to="/" className="home-button">Home</Link>
        </div>
      </div>
    );
  }

  // Handle lobby not in progress
  if (!lobby || lobby.status !== 'in_progress') {
    // If lobby doc gone but we have game result, show summary
    if (gameResult) {
      return <EndGameSummary result={gameResult} currentUserId={currentUserId} />;
    }
    return (
      <div className="game-container">
        <div className="waiting">
          <h2>Game Not Started</h2>
          <p>The game hasn't started yet. Please wait for the host to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Music Guessing Game</h1>
        <div className="round-info">
          <span>Game in Progress</span>
        </div>
        {lobby?.hostFirebaseUid === currentUserId && (
          <button className="end-game-btn" onClick={handleEndGameClick}>
            End Game
          </button>
        )}
      </div>

      {/* Score Board */}
      {lobby?.players && Object.keys(playerScores).length > 0 && (
        <div className="scoreboard-section">
          <h3>Scores</h3>
          <div className="scores-grid">
            {Object.entries(lobby.players)
              .map(([playerId, player]) => ({
                playerId,
                playerName: player.name,
                score: playerScores[playerId] || 0,
                isCurrentPlayer: playerId === currentUserId,
                isHost: player.isHost
              }))
              .sort((a, b) => {
                // Primary sort: by score (descending)
                if (a.score !== b.score) {
                  return b.score - a.score;
                }
                // Secondary sort: by name (ascending, alphabetical)
                return a.playerName.localeCompare(b.playerName);
              })
              .map(({ playerId, playerName, score, isCurrentPlayer, isHost }) => (
                <div 
                  key={playerId} 
                  className={`score-item ${isCurrentPlayer ? 'current-player' : ''} ${isHost ? 'host' : ''}`}
                >
                  <span className="player-name">
                    {playerName} {isCurrentPlayer && '(You)'} {isHost && '(Host)'} 
                  </span>
                  <span className="score">{score}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="game-content">
        {guessFeedback && (
          <div className={`guess-feedback ${guessFeedback.type}`}>
            {guessFeedback.message}
          </div>
        )}
        
        {isPlaying && currentTrack ? (
          <>
            <TrackInfo 
              track={currentTrack}
              isPlaying={true}
              startedAt={new Date(lastUpdated.getTime() - progressMs)}
            />
            
            {(() => {
              // Check if the current track is from the playlist
              const inPlaylist = !!(playlistCollection?.songs[currentTrack.uri]);
              const trackOwner = getTrackOwner(currentTrack.uri);
              const isTrackOwner = trackOwner === currentUserId;
              const guessingDisabled = lobby?.disableGuessing === true;
              const isTrackSolved = correctlyGuessedTracks[currentTrack.uri] === true;
              
              // Show GuessButtons if all conditions are met
              if (inPlaylist && !guessingDisabled && !isTrackOwner && !hasGuessed && !isTrackSolved && lobby?.players) {
                // Sort players alphabetically for consistent button order
                const sortedPlayers = Object.fromEntries(
                  Object.entries(lobby.players).sort(([, a], [, b]) => 
                    a.name.localeCompare(b.name)
                  )
                );
                
                return (
                  <GuessButtons
                    players={sortedPlayers}
                    excludedPlayerId={currentUserId || ''}
                    onGuess={handleGuess}
                  />
                );
              }
              
              // Show info about why guessing is not available
              if (inPlaylist) {
                return (
                  <div className="guessing-section">
                    <h3>Who added this song?</h3>
                    <p>🎵 {currentTrack.name} by {currentTrack.artists.map(a => a.name).join(', ')}</p>
                    {isTrackOwner && <p>You added this song!</p>}
                    {hasGuessed && <p>✅ You already guessed for this track.</p>}
                    {isTrackSolved && <p className="solved-track-message">🎯 This track has been correctly guessed!</p>}
                    {guessingDisabled && <p>Guessing is currently disabled.</p>}
                  </div>
                );
              }
              
              // Track is not from the playlist
              return (
                <div className="guessing-section">
                  <h3>Now Playing</h3>
                  <p>🎵 {currentTrack.name} by {currentTrack.artists.map(a => a.name).join(', ')}</p>
                  <p>This track is not from the game playlist.</p>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="waiting-for-host">
            <div className="waiting-icon">⏸️</div>
            <h2>Waiting for Host to play Spotify</h2>
            </div>
        )}
      </div>
    </div>
  );
}; 