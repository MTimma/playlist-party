import { useState, useEffect } from 'react';
import { subscribeUserSongs } from '../../services/firebase';
import type { Track } from '../../types/types';
import './MySongs.css';

interface MySongsProps {
  lobbyId: string;
  userId: string;
}

export const MySongs = ({ lobbyId, userId }: MySongsProps) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeUserSongs(lobbyId, userId, (userTracks) => {
      setTracks(userTracks);
    });

    return unsubscribe;
  }, [lobbyId, userId]);

  if (tracks.length === 0) {
    return (
      <div className="my-songs empty">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <p>No songs added yet</p>
          <span>Use the search below to add your first track!</span>
        </div>
      </div>
    );
  }

  const formatArtists = (artists: Array<{name: string, id: string}>) => {
    return artists.map(artist => artist.name).join(', ');
  };

  return (
    <div className="my-songs">
      {/* <div className="my-songs-header" onClick={() => setIsExpanded(!isExpanded)}> */}
      <div className="my-songs-header" >
        <div className="header-content">
          My songs
        </div>
        {/* <button className="expand-button" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
          >
            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
          </svg>
        </button> */}
      </div>

      {isExpanded && (
        <div className="my-songs-list">
          {tracks.map((track) => (
            <div key={track.uri} className="song-item">
              <div className="song-album">
                {track.album.images[0] ? (
                  <img
                    src={track.album.images[0].url}
                    alt={`${track.album.name} album cover`}
                    className="album-image"
                  />
                ) : (
                  <div className="album-placeholder">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                )}
              </div>

              <div className="song-info">
                <div className="song-name">{track.name}</div>
                <div className="song-artist">{formatArtists(track.artists)}</div>
              </div>

              {/* <div className="song-status">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="status-icon approved">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="status-text">Added to playlist</span>
              </div> */}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 