import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { 
  subscribePlaylistCollection, 
  subscribeLobby,
  getCurrentUser,
  signInAnonymouslyIfNeeded
} from '../../services/firebase';
import { validateGuess, checkPlayerGuess } from '../../services/backend';
import { TrackInfo } from '../TrackInfo/TrackInfo';
import { GuessButtons } from '../GuessButtons/GuessButtons';
import type { Track, PlaylistCollection, Lobby } from '../../types/types';
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
  const trackUri = currentTrack?.uri;
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

  // Check if player has already guessed for the current track
  useEffect(() => {
    const checkGuessStatus = async () => {
      if (!lobbyId || !currentUserId || !trackUri) {
        setHasGuessed(false);
        return;
      }

      try {
        const result = await checkPlayerGuess(lobbyId, currentUserId, trackUri);
        setHasGuessed(result.hasGuessed);
      } catch (error) {
        console.error('Error checking guess status:', error);
        setHasGuessed(false);
      }
    };

    checkGuessStatus();
  }, [lobbyId, currentUserId, trackUri]);

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
            // Convert Firebase track data to our Track type
            const incomingTrackData = lobbyData.currentTrack!; // non-null asserted because of the guard above
            const incomingUri = incomingTrackData.uri;
            setCurrentTrack(prev => {
              // Avoid recreating the Track object if URI did not change
              if (prev && prev.uri === incomingUri) {
                return prev;
              }
              return {
               uri: incomingUri,
               name: incomingTrackData.name,
               artists: incomingTrackData.artists,
               duration_ms: incomingTrackData.duration_ms,
               album: {
                 name: incomingTrackData.album.name,
                 images: incomingTrackData.album.images
               }
               } as Track;
             });
          setIsPlaying(true);
          setProgressMs(lobbyData.progressMs || 0);
          setLastUpdated(new Date());
        } else {
          setIsPlaying(false);
          setCurrentTrack(null);
          setProgressMs(0);
          setLastUpdated(new Date());
        }
      }
    });
    
    return () => unsubscribe();
  }, [lobbyId]);

  // Subscribe to playlist collection to get track info
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      setPlaylistCollection(collection);
    });
    
    return () => unsubscribe();
  }, [lobbyId]);

  // Helper function to get track owner (needed for guessing game)
  const getTrackOwner = (trackUri: string): string | null => {
    if (!playlistCollection) return null;
    return playlistCollection.songs[trackUri]?.addedBy || null;
  };

  const handleGuess = async (guessedOwnerId: string) => {
    if (!lobbyId || !currentUserId || !currentTrack) {
      throw new Error('Missing required data for guess');
    }

    try {
      const result = await validateGuess(lobbyId, currentUserId, currentTrack.uri, guessedOwnerId);
      setHasGuessed(true);
      return result;
    } catch (error) {
      console.error('Error submitting guess:', error);
      throw error;
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
      </div>

      <div className="game-content">
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
              
              // Show GuessButtons if all conditions are met
              if (inPlaylist && !guessingDisabled && !isTrackOwner && !hasGuessed && lobby?.players) {
                return (
                  <GuessButtons
                    players={lobby.players}
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
                    {hasGuessed && <p>You already guessed for this track.</p>}
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