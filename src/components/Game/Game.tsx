import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { 
  subscribePlaylistCollection, 
  subscribeLobby
} from '../../services/firebase';
import { getCurrentlyPlaying } from '../../services/backend';
import { TrackInfo } from '../TrackInfo/TrackInfo';
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
  const [isTabVisible, setIsTabVisible] = useState(true);
  const pollingStartedRef = useRef(false);

  // Track tab visibility to handle browser throttling
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      setIsTabVisible(visible);
      console.log('Tab visibility changed:', visible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Locally increment progress every second for smoother UX
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(() => {
      setProgressMs(prev => prev + 1000);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPlaying]);

  // Subscribe to lobby (now contains game state)
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribeLobby(lobbyId, (lobbyData) => {
      setLobby(lobbyData);
      if (lobbyData && lobbyData.status === 'in_progress') {
        setLoading(false);
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

  // Start polling immediately for any lobby - don't wait for Firebase subscription
  useEffect(() => {
    if (!lobbyId || pollingStartedRef.current) return;
    
    console.log('Starting independent polling for lobby:', lobbyId);
    pollingStartedRef.current = true;
    
    let pollCount = 0;
    let isMounted = true;
    
    const checkSpotifyPlayback = async () => {
      if (!isMounted) {
        console.log('Component unmounted, stopping poll');
        return;
      }
      
      pollCount++;
      // Only log every 10th poll to reduce noise
      if (pollCount % 10 === 1) {
        console.log(`Poll attempt #${pollCount} for lobby ${lobbyId} (tab visible: ${isTabVisible})`);
      }
      
      try {
        if (!lobbyId) return;
        const playbackData = await getCurrentlyPlaying(lobbyId);
        
        if (!isMounted) return; // Check again after async call
        
        // Only log when data changes or every 30 seconds
        if (pollCount % 30 === 1 || (playbackData?.is_playing !== isPlaying)) {
          console.log('Playback data received:', { 
            pollCount,
            tabVisible: isTabVisible,
            hasData: !!playbackData, 
            isPlaying: playbackData?.is_playing, 
            hasItem: !!playbackData?.item,
            trackName: playbackData?.item?.name 
          });
        }

        if (playbackData && playbackData.is_playing && playbackData.item) {
          const track: Track = {
            uri: playbackData.item.uri,
            name: playbackData.item.name,
            artists: playbackData.item.artists,
            duration_ms: playbackData.item.duration_ms,
            album: {
              name: playbackData.item.album.name,
              images: playbackData.item.album.images
            }
          };

          setCurrentTrack(track);
          setIsPlaying(true);
          // Reset progressMs to the value from Spotify; the local timer will continue from here
          setProgressMs(playbackData.progress_ms || 0);
        } else {
          setIsPlaying(false);
          setCurrentTrack(null);
          setProgressMs(0);
        }
      } catch (error) {
        console.error(`Error in poll #${pollCount} for lobby ${lobbyId}:`, error);
        // Don't stop polling on errors - just reset state and continue
        if (isMounted) {
          setIsPlaying(false);
          setCurrentTrack(null);
        }
      }
    };

    // Initial check
    checkSpotifyPlayback();

    // Set up interval to check every second
    console.log('Setting up independent polling interval for lobby:', lobbyId);
    const intervalId = setInterval(checkSpotifyPlayback, 1000);

    const cleanup = () => {
      console.log(`Cleaning up independent polling for lobby: ${lobbyId}, completed ${pollCount} polls`);
      isMounted = false;
      clearInterval(intervalId);
      pollingStartedRef.current = false;
    };

    // Store cleanup function to call it when component unmounts
    return cleanup;
  }, [lobbyId]); // Only depend on lobbyId - start once and never restart due to Firebase updates

  // Helper function to get track owner (needed for guessing game)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getTrackOwner = (trackUri: string): string | null => {
    if (!playlistCollection) return null;
    return playlistCollection.songs[trackUri]?.addedBy || null;
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
          <span>Round {lobby.currentRound || 1}</span>
        </div>
      </div>

      <div className="game-content">
        {isPlaying && currentTrack ? (
          <>
            <TrackInfo 
              track={currentTrack}
              isPlaying={true}
              startedAt={new Date(Date.now() - progressMs)}
            />
            
            {/* TODO: Add GuessButtons component here */}
            <div className="guessing-section">
              <h3>Who added this song?</h3>
              <p>🎵 {currentTrack.name} by {currentTrack.artists.map(a => a.name).join(', ')}</p>
              {/* GuessButtons will go here */}
            </div>
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