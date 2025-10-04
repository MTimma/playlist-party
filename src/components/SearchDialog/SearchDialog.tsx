import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { addTrackToPlaylist, subscribePlaylistCollection, removeTrackFromPlaylist, verifyHostStatus } from '../../services/firebase';
import type { Track, PlaylistCollection } from '../../types/types';
import './SearchDialog.css';
import TrackInfoCard from '../TrackInfoCard/TrackInfoCard';

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
  const [isHost, setIsHost] = useState<boolean>(false);

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

  // Check if current user is host for removal rights UI
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const result = await verifyHostStatus(lobbyId);
        if (active) setIsHost(result);
      } catch {
        // ignore
      }
    })();
    return () => { active = false; };
  }, [lobbyId]);

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

  const handleRemoveTrack = async (track: SearchResult) => {
    if (!track.isDuplicate) return;
    try {
      await removeTrackFromPlaylist(lobbyId, track.uri, currentUserId);
      setSearchResults(prev => prev.map(r => r.uri === track.uri ? { ...r, isDuplicate: false, addedBy: null, isAddedByCurrentUser: false } : r));
    } catch (err) {
      console.error('Error removing track:', err);
      setError('Failed to remove track.');
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
      return { text: '', className: 'added-by-user' };
    } else {
      return { text: 'Already picked', className: 'added-by-other' };
    }
  };

  return (
    <div className="search-dialog">
      <div className="search-section">
        <h4>Pick songs for the party!</h4>
        
        <div className="search-input-container">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for songs..."
            className="search-input"
          />

          {/* Clear (X) button */}
          {query && !isSearching && (
            <button
              type="button"
              className="clear-input-btn"
              onClick={() => {
                setQuery('');
                setSearchResults([]);
              }}
              aria-label="Clear search input"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}

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
              const albumImage = track.album.images[2]?.url || track.album.images[0]?.url;

              return (
                <div key={track.uri} style={{ padding: '8px 10px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                  <TrackInfoCard
                    albumImageUrl={albumImage}
                    name={track.name}
                    artistsText={track.artists.map((a) => a.name).join(', ')}
                    statusText={status?.text || null}
                    statusVariant={status?.className as 'added-by-user' | 'added-by-other' | undefined}
                    isDisabled={!isClickable}
                    onClick={() => {
                      if (!isClickable) return;
                      if (track.isDuplicate && track.isAddedByCurrentUser) {
                        handleRemoveTrack(track);
                      } else {
                        handleAddTrack(track);
                      }
                    }}
                    hasPreview={!!track.preview_url}
                    onPreview={(ev) => track.preview_url && playPreview(track.preview_url, ev)}
                    showRemove={track.isDuplicate && (track.isAddedByCurrentUser || isHost)}
                    onRemove={() => handleRemoveTrack(track)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>


    </div>
  );
}; 