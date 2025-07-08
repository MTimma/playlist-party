import { useState, useEffect } from 'react';
import { subscribePlaylistCollection } from '../../services/firebase';
import type { Track } from '../../types/types';
import './MySongs.css';

interface MySongsProps {
  lobbyId: string;
  userId: string;
}

export const MySongs = ({ lobbyId, userId }: MySongsProps) => {
  const [mySongs, setMySongs] = useState<Track[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Subscribe to playlist collection and extract songs added by this user
  useEffect(() => {
    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      if (!collection) {
        setMySongs([]);
        return;
      }

      const songs = Object.entries(collection.songs || {})
        .filter(([_, songData]) => (songData as any).addedBy === userId)
        .map(([_, songData]) => (songData as any).trackInfo as Track);

      setMySongs(songs);
    });

    return unsubscribe;
  }, [lobbyId, userId]);

  if (mySongs.length === 0) {
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

  return (
    <div className="my-songs">
      <div className="my-songs-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <h4 className="my-songs-title">My Songs ({mySongs.length})</h4>
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
          {mySongs.map((track) => (
            <div key={track.uri} className="song-item approved">
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 