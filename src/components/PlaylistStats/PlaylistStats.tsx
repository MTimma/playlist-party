import { useState, useEffect } from 'react';
import { subscribePlaylistCollection} from '../../services/firebase';
import type { PlaylistCollection } from '../../types/types';
import './PlaylistStats.css';

interface PlaylistStatsProps {
  lobbyId: string;
  onStartGame: () => void;
}

export const PlaylistStats = ({ lobbyId, onStartGame }: PlaylistStatsProps) => {
  const [playlistData, setPlaylistData] = useState<PlaylistCollection | null>(null);
  const [isStartingGame, setIsStartingGame] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!lobbyId) return;

    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      setPlaylistData(collection);
    });

    return unsubscribe;
  }, [lobbyId]);

  const handleStartGame = async () => {
    if (!playlistData || playlistData.stats.totalSongs < 2) return;
    
    setIsStartingGame(true);
    setError(null);

    try {
      onStartGame();
    } catch (err) {
      console.error('Error starting game:', err);
      setError('Failed to start game. Please try again.');
    } finally {
      setIsStartingGame(false);
    }
  };

  const canStartGame = () => {
    if (!playlistData) return false;
    return playlistData.stats.totalSongs >= 2 && playlistData.stats.playersWithSongs >= 2;
  };

    // const canStartGame = () => {
    //  return true;
    // };

  if (!playlistData) {
    return (
      <div className="playlist-stats">
        <div className="stats-loading">
          <div className="spinner small"></div>
          <span>Loading playlist data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="playlist-stats">
      <h4>Playlist Progress</h4>
      
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
          </div>
          <div className="stat-content">
            <h5>Total Songs</h5>
            <span className="stat-number">{playlistData.stats.totalSongs}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 4c4.42 0 8 3.58 8 8s-3.58 8-8 8-8-3.58-8-8 3.58-8 8-8m0-2C9.37 2 4 7.37 4 14s5.37 12 12 12 12-5.37 12-12S22.63 2 16 2zm-3 8c0-1.66 1.34-3 3-3s3 1.34 3 3-1.34 3-3 3-3-1.34-3-3z"/>
            </svg>
          </div>
          <div className="stat-content">
            <h5>Players Contributing</h5>
            <span className="stat-number">{playlistData.stats.playersWithSongs}</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
          </div>
          <div className="stat-content">
            <h5>Minimum for Game</h5>
            <span className="stat-number">2 songs</span>
          </div>
        </div>
      </div>

      <div className="playlist-status">
        {canStartGame() ? (
          <div className="status-ready">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
            </svg>
            <span>Ready to start game!</span>
          </div>
        ) : (
          <div className="status-waiting">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>
              Need at least 2 songs from 2 players 
              {playlistData.stats.totalSongs < 2 && ` (${2 - playlistData.stats.totalSongs} more songs needed)`}
              {playlistData.stats.playersWithSongs < 2 && ` (${2 - playlistData.stats.playersWithSongs} more players need to add songs)`}
            </span>
          </div>
        )}
      </div>

      {error && (
        <div className="start-game-error">
          <span>{error}</span>
        </div>
      )}

      <div className="start-game-section">
        <button
          onClick={handleStartGame}
          disabled={!canStartGame() || isStartingGame}
          className={`start-game-btn ${canStartGame() ? 'ready' : 'disabled'}`}
        >
          {isStartingGame ? (
            <>
              <div className="spinner small"></div>
              <span>Starting Game...</span>
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
              <span>Start Game</span>
            </>
          )}
        </button>
        
        <p className="start-game-note">
          Once started, no more songs can be added and players will begin guessing!
        </p>
      </div>

      {/* Debug info (can be removed in production) */}
      {import.meta.env.DEV && (
        <details className="debug-info">
          <summary>Debug Info</summary>
          <pre>{JSON.stringify(playlistData, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}; 