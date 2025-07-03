import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  subscribeGameState, 
  subscribePlaylistCollection, 
  subscribeLobby 
} from '../../services/firebase';
import { TrackInfo } from '../TrackInfo/TrackInfo';
import type { GameState, Track, PlaylistCollection, Lobby } from '../../types/types';
import './Game.css';

export const Game = () => {
  const { lobbyId } = useParams<{ lobbyId: string }>();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [lobby, setLobby] = useState<Lobby | null>(null);
  const [playlistCollection, setPlaylistCollection] = useState<PlaylistCollection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to lobby status to determine if game should be active
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribeLobby(lobbyId, (lobbyData) => {
      setLobby(lobbyData);
      if (lobbyData && lobbyData.status !== 'in_progress') {
        setLoading(false);
      }
    });
    
    return () => unsubscribe();
  }, [lobbyId]);

  // Subscribe to game state when lobby is in progress
  useEffect(() => {
    if (!lobbyId || !lobby || lobby.status !== 'in_progress') return;
    
    const unsubscribe = subscribeGameState(lobbyId, (state) => {
      setGameState(state);
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [lobbyId, lobby]);

  // Subscribe to playlist collection to get track info
  useEffect(() => {
    if (!lobbyId) return;
    
    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      setPlaylistCollection(collection);
    });
    
    return () => unsubscribe();
  }, [lobbyId]);

  // Get current track info when game state changes
  useEffect(() => {
    if (!gameState || !playlistCollection) {
      setCurrentTrack(null);
      return;
    }

    const trackUri = gameState.currentTrackUri;
    if (!trackUri) {
      setCurrentTrack(null);
      return;
    }

    // Get track from playlist collection
    const songData = playlistCollection.songs[trackUri];
    if (songData) {
      setCurrentTrack(songData.trackInfo);
    } else {
      setCurrentTrack(null);
      setError('Track not found in playlist');
    }
  }, [gameState, playlistCollection]);

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

  // Handle error state
  if (error) {
    return (
      <div className="game-container">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
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

  // Handle no game state
  if (!gameState) {
    return (
      <div className="game-container">
        <div className="waiting">
          <h2>Waiting for Game State</h2>
          <p>Setting up the game...</p>
        </div>
      </div>
    );
  }

  // Calculate progress start time for live updates
  const progressStartTime = gameState.startedAt instanceof Date 
    ? gameState.startedAt 
    : gameState.startedAt.toDate();

  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Music Guessing Game</h1>
        <div className="round-info">
          <span>Round {gameState.currentRound}</span>
        </div>
      </div>

      <div className="game-content">
        <TrackInfo 
          track={currentTrack}
          progressMs={gameState.progressMs}
          isPlaying={gameState.isPlaying}
          startedAt={progressStartTime}
        />
        
        {/* Phase 5 will add GuessButtons and ScoreBoard components here */}
        {!gameState.isPlaying && currentTrack && (
          <div className="game-status">
            <p>Waiting for host to start the playlist...</p>
          </div>
        )}
      </div>
    </div>
  );
}; 