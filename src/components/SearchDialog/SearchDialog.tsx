import { useState, useEffect, useCallback } from 'react';
import { debounce } from 'lodash';
import { addTrackProposal, subscribeTrackProposals } from '../../services/firebase';
import type { Track, TrackProposal } from '../../types/types';
import './SearchDialog.css';

interface SearchDialogProps {
  lobbyId: string;
  currentUserId: string;
  isHost: boolean;
}

interface SearchResult extends Track {
  isAlreadyAdded?: boolean;
  isDuplicate?: boolean;
}

export const SearchDialog = ({ lobbyId, currentUserId, isHost }: SearchDialogProps) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [userProposals, setUserProposals] = useState<TrackProposal[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to user's proposals to show status
  useEffect(() => {
    if (!lobbyId || !currentUserId) return;

    const unsubscribe = subscribeTrackProposals(lobbyId, currentUserId, (proposals) => {
      setUserProposals(proposals);
    });

    return unsubscribe;
  }, [lobbyId, currentUserId]);

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
        
        // Check for duplicates against existing proposals
        const resultsWithDuplicateCheck = data.tracks.map((track: Track) => ({
          ...track,
          isDuplicate: userProposals.some(proposal => proposal.trackUri === track.uri)
        }));

        setSearchResults(resultsWithDuplicateCheck);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search tracks. Please try again.');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 400),
    [userProposals]
  );

  // Trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
    return () => {
      debouncedSearch.cancel();
    };
  }, [query, debouncedSearch]);

  const handleAddTrack = async (track: Track) => {
    try {
      setError(null);
      console.log('Adding track proposal:', {
        lobbyId,
        currentUserId,
        trackUri: track.uri,
        trackName: track.name
      });
      
      await addTrackProposal(lobbyId, currentUserId, track);
      
      // Update search results to show this track as added
      setSearchResults(prev => 
        prev.map(result => 
          result.uri === track.uri 
            ? { ...result, isDuplicate: true }
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

  const playPreview = (previewUrl: string) => {
    // Create audio element for preview
    const audio = new Audio(previewUrl);
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.error('Error playing preview:', err);
    });
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
            {searchResults.map((track) => (
              <div key={track.uri} className="search-result-item">
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
                      onClick={() => playPreview(track.preview_url!)}
                      className="preview-btn"
                      title="Play 30s preview"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleAddTrack(track)}
                    disabled={track.isDuplicate}
                    className={`add-btn ${track.isDuplicate ? 'disabled' : ''}`}
                    title={track.isDuplicate ? 'Already added' : 'Add to playlist'}
                  >
                    {track.isDuplicate ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* User's proposed tracks */}
      {userProposals.length > 0 && (
        <div className="user-proposals">
          <h4>Your Proposed Tracks</h4>
          <div className="proposals-list">
            {userProposals.map((proposal) => (
              <div key={proposal.trackUri} className="proposal-item">
                <div className="track-info">
                  <img 
                    src={proposal.trackInfo.album.images[2]?.url || proposal.trackInfo.album.images[0]?.url} 
                    alt={proposal.trackInfo.album.name}
                    className="track-image small"
                  />
                  <div className="track-details">
                    <h6 className="track-name">{proposal.trackInfo.name}</h6>
                    <p className="track-artist">
                      {proposal.trackInfo.artists.map(artist => artist.name).join(', ')}
                    </p>
                  </div>
                </div>
                
                <div className={`proposal-status ${proposal.status}`}>
                  {proposal.status === 'pending' && (
                    <>
                      <div className="status-spinner"></div>
                      <span>Pending</span>
                    </>
                  )}
                  {proposal.status === 'approved' && (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                      </svg>
                      <span>Added</span>
                    </>
                  )}
                  {proposal.status === 'rejected' && (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                      </svg>
                      <span>Failed</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 