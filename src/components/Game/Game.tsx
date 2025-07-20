import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  subscribePlaylistCollection, 
  subscribeLobby
} from '../../services/firebase';
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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Locally increment progress every second for smoother UX
  useEffect(() => {
    if (!isPlaying) return;

    const intervalId = setInterval(() => {
      setProgressMs(prev => prev + 1000);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isPlaying]);

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
          const track: Track = {
            uri: lobbyData.currentTrack.uri,
            name: lobbyData.currentTrack.name,
            artists: lobbyData.currentTrack.artists,
            duration_ms: lobbyData.currentTrack.duration_ms,
            album: {
              name: lobbyData.currentTrack.album.name,
              images: lobbyData.currentTrack.album.images
            }
          };
          
          setCurrentTrack(track);
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
              startedAt={new Date(lastUpdated.getTime() - progressMs)}
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