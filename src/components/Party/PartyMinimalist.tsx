import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  subscribePlaylistCollection, 
  subscribeLobby,
  getCurrentUser,
  signInAnonymouslyIfNeeded,
  subscribeGameResult,
  updateTrackComment
} from '../../services/firebase';
import { validateGuess, checkPlayerGuess, endGame } from '../../services/backend';
import { MinimalistHeader } from '../MinimalistHeader/MinimalistHeader';
import { AlbumArtCard } from '../AlbumArtCard/AlbumArtCard';
import { CleanGuessButtons } from '../CleanGuessButtons/CleanGuessButtons';
import { CommentPrompt } from '../CommentPrompt/CommentPrompt';
import { CommentCard } from '../CommentCard/CommentCard';
import { EndPartySummary } from '../EndPartySummary/EndPartySummary';
import type { Track, PlaylistCollection, Lobby, GameResult } from '../../types/types';
import './PartyMinimalist.css';

export const PartyMinimalist = () => {
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
  const [isEndingGame, setIsEndingGame] = useState(false);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  
  // New states for comment system
  const [showCommentPrompt, setShowCommentPrompt] = useState(false);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [trackReactions, setTrackReactions] = useState<Record<string, any>>({});

  // Ensure the user is authenticated and keep uid in state
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        const user = await signInAnonymouslyIfNeeded();
        if (isMounted) {
          setCurrentUserId(user.uid);
        }
      } catch (err) {
        console.error('Failed to authenticate user:', err);
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
      setPlayerScores({});
      return;
    }
    
    setPlayerScores(lobby.playerScores);
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

  // Check if player has already guessed for the current track
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
          setGuessFeedback(null);
        }
      }
    });
    
    return () => unsubscribe();
  }, [lobbyId, currentTrackUri]);

  // Countdown to auto-end: 1 hour from lobby.startedAt
  useEffect(() => {
    if (!lobby || lobby.status !== 'in_progress') { 
      setRemainingMs(null); 
      return; 
    }
    
    const startedAtValue = lobby.startedAt as unknown;
    let startedAtDate: Date | null = null;
    
    if (startedAtValue && typeof startedAtValue === 'object' && 'toDate' in (startedAtValue as { toDate?: () => Date })) {
      startedAtDate = (startedAtValue as { toDate: () => Date }).toDate();
    } else if (startedAtValue instanceof Date) {
      startedAtDate = startedAtValue as Date;
    }

    if (!startedAtDate) { 
      setRemainingMs(null); 
      return; 
    }

    const endAt = new Date(startedAtDate.getTime() + 60 * 60 * 1000);

    const tick = () => {
      const ms = Math.max(0, endAt.getTime() - Date.now());
      setRemainingMs(ms);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lobby, currentUserId, isEndingGame, lobbyId]);

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
    const unsub = subscribeGameResult(lobbyId, (res) => {
      setGameResult(res);
      setLoading(false);
      setIsEndingGame(false);
    });
    return () => unsub();
  }, [lobbyId]);

  const handleEndGameClick = async () => {
    if (!lobbyId) return;
    if (!window.confirm('End the game for all players?')) return;
    
    setIsEndingGame(true);
    try {
      await endGame(lobbyId);
    } catch (err) {
      setIsEndingGame(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to end game';
      alert(errorMessage);
    }
  };

  // Helper function to get track owner
  const getTrackOwner = (trackUri: string): string | null => {
    if (!playlistCollection) return null;
    return playlistCollection.songs[trackUri]?.addedBy || null;
  };

  const handleGuess = async (guessedOwnerId: string): Promise<{ isCorrect: boolean; correctOwnerId?: string; correctOwnerName?: string; scoreChange: number }> => {
    if (!lobbyId || !currentUserId || !currentTrack) {
      throw new Error('Missing required data for guess');
    }

    const now = Date.now();
    if (isGuessing || now - lastGuessTime < 2000) {
      console.log('Guess blocked: too recent or already guessing');
      throw new Error('Please wait before guessing again');
    }

    setIsGuessing(true);
    setLastGuessTime(now);
    
    try {
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
            setCorrectlyGuessedTracks(prev => ({
              ...prev,
              [currentTrack.uri]: true
            }));
            
            // Show comment prompt after correct guess
            setTimeout(() => {
              setShowCommentPrompt(true);
            }, 2000);
          } else {
            setGuessFeedback({ 
              type: 'incorrect', 
              message: `Oh no, that doesn't look correct! ${result.scoreChange} point${Math.abs(result.scoreChange) !== 1 ? 's' : ''}!` 
            });
          }
          
          setTimeout(() => setGuessFeedback(null), 4000);
          
          return result;
        } catch (error) {
          retryCount++;
          console.error(`Guess submission attempt ${retryCount} failed:`, error);
          
          if (error instanceof Error && (
            error.message.includes('Track already correctly guessed') ||
            error.message.includes('Already guessed for this track')
          )) {
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
          
          if (retryCount < maxRetries && (
            error instanceof TypeError ||
            (error instanceof Error && error.message.includes('Failed to fetch'))
          )) {
            console.log(`Retrying guess submission in ${retryCount * 1000}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryCount * 1000));
            continue;
          }
          
          throw error;
        }
      }
      
      throw new Error('Failed to submit guess after maximum retries');
    } finally {
      setIsGuessing(false);
    }
  };

  const handleCommentSubmit = async (comment: { text: string; promptKey?: string }) => {
    if (!lobbyId || !currentTrack || !currentUserId) return;

    setIsSubmittingComment(true);
    try {
      await updateTrackComment(lobbyId, currentTrack.uri, comment, currentUserId);
      setShowCommentPrompt(false);
    } catch (error) {
      console.error('Failed to submit comment:', error);
      throw error;
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleCommentSkip = () => {
    setShowCommentPrompt(false);
  };

  const handleReaction = async (type: 'heart' | 'thumbs' | 'fire') => {
    // TODO: Implement reaction system with Firebase
    console.log('Reaction:', type);
  };

  // Handle loading state
  if (loading || isEndingGame) {
    return (
      <div className="minimalist-party">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">
            {isEndingGame ? 'Ending party...' : 'Loading game...'}
          </p>
        </div>
      </div>
    );
  }

  // Handle lobby terminated by host
  if (lobby && lobby.status === 'terminated_by_host') {
    return (
      <div className="minimalist-party">
        <div className="waiting-container">
          <div className="waiting-icon">🎉</div>
          <h2 className="waiting-title">Game ended</h2>
          <p className="waiting-message">The host has ended this game</p>
          <Link to="/" className="lobby-button" style={{ marginTop: '24px', display: 'inline-block', textDecoration: 'none' }}>
            Home
          </Link>
        </div>
      </div>
    );
  }

  // Handle lobby not in progress
  if (!lobby || lobby.status !== 'in_progress') {
    if (gameResult) {
      return <EndPartySummary result={gameResult} currentUserId={currentUserId} />;
    }
    
    if (isEndingGame) {
      return (
        <div className="minimalist-party">
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p className="loading-text">Ending party...</p>
          </div>
        </div>
      );
    }
    
    return (
      <div className="minimalist-party">
        <div className="waiting-container">
          <div className="waiting-icon">⏳</div>
          <h2 className="waiting-title">Party Not Started</h2>
          <p className="waiting-message">The party hasn't started yet. Please wait for the host to begin.</p>
        </div>
      </div>
    );
  }

  const isHost = lobby?.hostFirebaseUid === currentUserId;
  
  // Calculate guess window timing
  const startedAt = new Date(lastUpdated.getTime() - progressMs);
  const elapsedMs = Date.now() - startedAt.getTime();
  const windowMs = lobby?.guessWindowMs ?? 30000;
  const isGuessWindowOver = elapsedMs >= windowMs;
  
  const ownerId = currentTrack ? getTrackOwner(currentTrack.uri) : null;
  const owner = ownerId ? lobby?.players[ownerId] : null;
  const ownerName = owner?.name;

  return (
    <div className="minimalist-party">
      <MinimalistHeader
        lobby={lobby}
        currentUserId={currentUserId}
        playerScores={playerScores}
        remainingMs={remainingMs}
        isHost={isHost}
        onEndGame={handleEndGameClick}
        isEndingGame={isEndingGame}
      />

      <div className="game-main">
        {isPlaying && currentTrack ? (
          <>
            <AlbumArtCard
              track={currentTrack}
              playlistCollection={playlistCollection}
              isGuessWindowOver={isGuessWindowOver}
              ownerName={ownerName}
            />
            
            {(() => {
              const inPlaylist = !!(playlistCollection?.songs[currentTrack.uri]);
              const trackOwner = getTrackOwner(currentTrack.uri);
              const isTrackOwner = trackOwner === currentUserId;
              const guessingDisabled = lobby?.disableGuessing === true;
              const isTrackSolved = correctlyGuessedTracks[currentTrack.uri] === true;
              
              if (inPlaylist && !guessingDisabled && !isTrackOwner && !hasGuessed && !isTrackSolved && lobby?.players && !isGuessWindowOver) {
                const sortedPlayers = Object.fromEntries(
                  Object.entries(lobby.players).sort(([, a], [, b]) => 
                    a.name.localeCompare(b.name)
                  )
                );
                
                return (
                  <CleanGuessButtons
                    players={sortedPlayers}
                    excludedPlayerId={currentUserId || ''}
                    onGuess={handleGuess}
                    currentTrackName={currentTrack.name}
                  />
                );
              }
              
              if (inPlaylist) {
                return (
                  <div className="guess-section">
                    <div className="guess-header">
                      <h3 className="guess-title">Who added this song?</h3>
                      <p className="guess-subtitle">🎵 {currentTrack.name}</p>
                    </div>
                    
                    {guessFeedback && (
                      <div className={`guess-feedback ${guessFeedback.type}`}>
                        {guessFeedback.message}
                      </div>
                    )}
                    
                    <div className="waiting-container" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                      {isTrackOwner && <p className="waiting-message">You added this song! 🎵</p>}
                      {hasGuessed && <p className="waiting-message">✅ You already guessed for this track.</p>}
                      {isTrackSolved && <p className="waiting-message">🎯 This track has been correctly guessed!</p>}
                      {guessingDisabled && <p className="waiting-message">Guessing is currently disabled.</p>}
                      {isGuessWindowOver && <p className="waiting-message">⏰ Guess window has ended.</p>}
                    </div>
                  </div>
                );
              }
              
              return (
                <div className="guess-section">
                  <div className="guess-header">
                    <h3 className="guess-title">Now Playing</h3>
                    <p className="guess-subtitle">🎵 {currentTrack.name}</p>
                  </div>
                  <div className="waiting-container" style={{ background: 'transparent', boxShadow: 'none', border: 'none' }}>
                    <p className="waiting-message">This track is not from the game playlist.</p>
                  </div>
                </div>
              );
            })()}
          </>
        ) : (
          <div className="waiting-container">
            <div className="waiting-icon">⏸️</div>
            <h2 className="waiting-title">Waiting for Host to play Spotify</h2>
          </div>
        )}
      </div>

      {showCommentPrompt && currentTrack && (
        <CommentPrompt
          trackName={currentTrack.name}
          onSubmit={handleCommentSubmit}
          onSkip={handleCommentSkip}
          isSubmitting={isSubmittingComment}
        />
      )}
    </div>
  );
};

