import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { addTrackToPlaylist, subscribePlaylistCollection } from '../../services/firebase';
import type { Track, PlaylistCollection } from '../../types/types';
import './SearchDialog.css';

interface SearchDialogProps {
  lobbyId: string;
  currentUserId: string;
}

interface SearchResult extends Track {
  isAlreadyAdded?: boolean;
  isDuplicate?: boolean;
  addedBy?: string | null;
  isAddedByCurrentUser?: boolean;
}

export const SearchDialog = ({ lobbyId, currentUserId }: SearchDialogProps) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playlistData, setPlaylistData] = useState<PlaylistCollection | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to playlist collection to check for duplicates
  useEffect(() => {
    if (!lobbyId) return;

    const unsubscribe = subscribePlaylistCollection(lobbyId, (collection) => {
      setPlaylistData(collection);
      
      // Update search results if they exist
      if (searchResults.length > 0 && collection) {
        setSearchResults(prevResults => 
          prevResults.map(track => {
            const songData = collection.songs?.[track.uri];
            return {
              ...track,
              isDuplicate: !!songData,
              addedBy: songData?.addedBy || null,
              isAddedByCurrentUser: songData?.addedBy === currentUserId
            };
          })
        );
      }
    });

    return unsubscribe;
  }, [lobbyId, currentUserId, searchResults.length]);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/spotify/search?q=${encodeURIComponent(searchQuery)}&type=track&limit=10`, {
          credentials: 'include',
          headers: {
            'Accept': 'application/json'
          }
        });

        if (!response.ok) {
          throw new Error('Search failed');
        }

        const data = await response.json();
        
        // Check for duplicates against existing playlist songs
        const resultsWithDuplicateCheck = data.tracks.map((track: Track) => {
          const songData = playlistData?.songs?.[track.uri];
          return {
            ...track,
            isDuplicate: !!songData,
            addedBy: songData?.addedBy || null,
            isAddedByCurrentUser: songData?.addedBy === currentUserId
          };
        });

        setSearchResults(resultsWithDuplicateCheck);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search tracks. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400),
    [playlistData, currentUserId]
  );

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  const handleAddTrack = async (track: SearchResult) => {
    // Don't allow adding if already added by someone else
    if (track.isDuplicate && !track.isAddedByCurrentUser) {
      return;
    }

    try {
      setError(null);
      console.log('Adding track proposal:', {
        lobbyId,
        currentUserId,
        trackUri: track.uri,
        trackName: track.name
      });
      await addTrackToPlaylist(lobbyId, track.uri, currentUserId, track);
      
      // Update search results to show this track as added
      setSearchResults(prev => 
        prev.map(result => 
          result.uri === track.uri 
            ? { ...result, isDuplicate: true, addedBy: currentUserId, isAddedByCurrentUser: true }
            : result
        )
      );
    } catch (err) {
      console.error('Error adding track:', err);
      console.error('Error details:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        lobbyId,
        currentUserId,
        trackUri: track.uri
      });
      setError('Failed to add track. Please try again.');
    }
  };

  const playPreview = (previewUrl: string, event: React.MouseEvent) => {
    // Stop propagation to prevent triggering row click
    event.stopPropagation();
    
    // Create audio element for preview
    const audio = new Audio(previewUrl);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.error('Error playing preview:', err);
    });
  };

  const getTrackStatus = (track: SearchResult) => {
    if (!track.isDuplicate) return null;
    
    if (track.isAddedByCurrentUser) {
      return { text: 'Added by you', className: 'added-by-user' };
    } else {
      return { text: 'Already added', className: 'added-by-other' };
    }
  };

  return (
    <div className="search-dialog">
      <div className="search-section">
        <h4>Add Songs to Playlist</h4>
        
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs..."
            className="search-input"
          />
          {isSearching && (
            <div className="search-spinner">
              <div className="spinner small"></div>
            </div>
          )}
        </div>

        {error && (
          <div className="search-error">
            <span>{error}</span>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map((track) => {
              const status = getTrackStatus(track);
              const isClickable = !track.isDuplicate || track.isAddedByCurrentUser;
              
              return (
                <div 
                  key={track.uri} 
                  className={`search-result-item ${!isClickable ? 'disabled' : ''} ${track.isDuplicate ? 'already-added' : ''}`}
                  onClick={() => isClickable && handleAddTrack(track)}
                  role="button"
                  tabIndex={isClickable ? 0 : -1}
                  aria-disabled={!isClickable}
                >
                  <div className="track-info">
                    <img 
                      src={track.album.images[2]?.url || track.album.images[0]?.url} 
                      alt={track.album.name}
                      className="track-image"
                    />
                    <div className="track-details">
                      <h5 className="track-name">{track.name}</h5>
                      <p className="track-artist">
                        {track.artists.map(artist => artist.name).join(', ')}
                      </p>
                      <p className="track-album">{track.album.name}</p>
                    </div>
                  </div>
                  
                  <div className="track-actions">
                    {track.preview_url && (
                      <button
                        onClick={(e) => playPreview(track.preview_url!, e)}
                        className="preview-btn"
                        title="Play 30s preview"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </button>
                    )}
                    
                    {status && (
                      <div className={`track-status ${status.className}`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                        <span>{status.text}</span>
                      </div>
                    )}
                    
                    {!track.isDuplicate && (
                      <div className="add-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}; 