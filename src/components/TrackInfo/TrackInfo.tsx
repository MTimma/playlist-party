import { useEffect, useState } from 'react';
import { getCurrentPlaybackState } from '../../services/spotify';
import type { Track } from '../../types/types';
import './TrackInfo.css';

interface TrackInfoProps {
  track: Track | null;
  isPlaying: boolean;
  startedAt: Date;
}

export const TrackInfo = ({ track, isPlaying, startedAt }: TrackInfoProps) => {
  const [currentProgressMs, setCurrentProgressMs] = useState(0);
  const [spotifyProgressMs, setSpotifyProgressMs] = useState(0);

  // Get real-time progress from Spotify API
  useEffect(() => {
    if (!isPlaying || !track) {
      setSpotifyProgressMs(0);
      return;
    }

    const fetchProgress = async () => {
      try {
        const playbackState = await getCurrentPlaybackState();
        if (playbackState && playbackState.item && playbackState.item.uri === track.uri) {
          setSpotifyProgressMs(playbackState.progress_ms || 0);
        }
      } catch (error) {
        console.error('Error fetching Spotify progress:', error);
      }
    };

    // Fetch immediately
    fetchProgress();

    // Then fetch every second
    const interval = setInterval(fetchProgress, 1000);

    return () => clearInterval(interval);
  }, [isPlaying, track]);

  // Fallback to estimated progress if Spotify API fails
  useEffect(() => {
    if (!isPlaying) {
      setCurrentProgressMs(0);
      return;
    }

    if (spotifyProgressMs > 0) {
      // Use real Spotify progress
      setCurrentProgressMs(spotifyProgressMs);
    } else {
      // Fallback to estimated progress
      const elapsed = Date.now() - startedAt.getTime();
      setCurrentProgressMs(elapsed);
    }
  }, [isPlaying, spotifyProgressMs, startedAt]);

  if (!track) {
    return (
      <div className="track-info">
        <div className="waiting-message">
          <h2>Waiting for host to start the playlist...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.min(
    (currentProgressMs / track.duration_ms) * 100,
    100
  );

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="track-info">
      <div className="track-details">
        {track.album.images.length > 0 && (
          <img 
            src={track.album.images[0].url} 
            alt={`${track.album.name} cover`}
            className="album-art"
          />
        )}
        <div className="track-text">
          <h2 className="track-title">{track.name}</h2>
          <p className="track-artists">
            {track.artists.map(artist => artist.name).join(', ')}
          </p>
          <p className="track-album">{track.album.name}</p>
        </div>
      </div>
      
      <div className="progress-section">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${progressPercentage}%` }}
          ></div>
        </div>
        <div className="progress-time">
          <span>{formatTime(currentProgressMs)}</span>
          <span>{formatTime(track.duration_ms)}</span>
        </div>
      </div>
      
      {!isPlaying && (
        <div className="paused-indicator">
          <span>⏸️ Paused</span>
        </div>
      )}
    </div>
  );
}; 