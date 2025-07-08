import { useState, useEffect } from 'react';
import { subscribePlaylistCollection } from '../../services/firebase';
import type { PlaylistCollection } from '../../types/types';
import './MySongs.css';

interface MySongsProps {
  lobbyId: string;
  userId: string;
}

export const MySongs = ({ lobbyId, userId }: MySongsProps) => {
  const [mySongs, setMySongs] = useState<PlaylistCollection['songs']>({});
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    // Subscribe to playlist collection and filter songs added by the current user
    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      if (!collection) {
        setMySongs({});
        return;
      }

      const userSongs = Object.fromEntries(
        Object.entries(collection.songs || {}).filter(([, songData]) => songData.addedBy === userId)
      );
      setMySongs(userSongs);
    });

    return unsubscribe;
  }, [lobbyId, userId]);

  const songCount = Object.keys(mySongs).length;

  if (songCount === 0) {
    return (
      <div className="my-songs empty">
        <div className="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <p>No songs added yet</p>
          <span>Use the search above to add your first track!</span>
        </div>
      </div>
    );
  }

  const formatArtists = (artists: Array<{name: string, id: string}>) => {
    return artists.map(artist => artist.name).join(', ');
  };

  const getStatusIcon = (status: 'approved' | 'rejected' | 'pending') => {
    switch (status) {
      case 'approved':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="status-icon approved">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
        );
      case 'rejected':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="status-icon rejected">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.59 5L12 10.59 8.41 7 7 8.41 10.59 12 7 15.59 8.41 17 12 13.41 15.59 17 17 15.59 13.41 12 17 8.41 15.59 7z"/>
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="status-icon pending">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" opacity="0.3"/>
          </svg>
        );
    }
  };

  return (
    <div className="my-songs">
      <div className="my-songs-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <h4 className="my-songs-title">My Songs ({songCount})</h4>
          <div className="header-stats">
            {songCount} added
          </div>
        </div>
        <button className="expand-button" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
          <svg 
            width="20" 
            height="20" 
            viewBox="0 0 24 24" 
            fill="currentColor"
            className={`expand-icon ${isExpanded ? 'expanded' : ''}`}
          >
            <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/>
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div className="my-songs-list">
          {Object.entries(mySongs).map(([trackUri, song]) => (
            <div key={trackUri} className="song-item approved">
              <div className="song-album">
                {song.trackInfo.album.images[0] ? (
                  <img
                    src={song.trackInfo.album.images[0].url}
                    alt={`${song.trackInfo.album.name} album cover`}
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
                <div className="song-name">{song.trackInfo.name}</div>
                <div className="song-artist">{formatArtists(song.trackInfo.artists)}</div>
              </div>

              <div className="song-status">
                {getStatusIcon('approved')}
                <span className="status-text">Added to playlist</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 