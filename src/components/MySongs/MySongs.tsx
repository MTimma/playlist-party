import { useState, useEffect } from 'react';
import { subscribeTrackProposals } from '../../services/firebase';
import type { TrackProposal } from '../../types/types';
import './MySongs.css';

interface MySongsProps {
  lobbyId: string;
  userId: string;
}

export const MySongs = ({ lobbyId, userId }: MySongsProps) => {
  const [proposals, setProposals] = useState<TrackProposal[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeTrackProposals(lobbyId, userId, (userProposals) => {
      const myProposals = userProposals.filter(p => p.proposedBy === userId);
      setProposals(myProposals);
    });

    return unsubscribe;
  }, [lobbyId, userId]);

  if (proposals.length === 0) {
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

  const getStatusIcon = (status: TrackProposal['status']) => {
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

  const getStatusText = (status: TrackProposal['status']) => {
    switch (status) {
      case 'approved': return 'Added to playlist';
      case 'rejected': return 'Not added';
      default: return 'Pending';
    }
  };

  return (
    <div className="my-songs">
      <div className="my-songs-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-content">
          <h4 className="my-songs-title">My Songs ({proposals.length})</h4>
          <div className="header-stats">
            {proposals.filter(p => p.status === 'approved').length} added
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
          {proposals.map((proposal) => (
            <div key={proposal.trackUri} className={`song-item ${proposal.status}`}>
              <div className="song-album">
                {proposal.trackInfo.album.images[0] ? (
                  <img
                    src={proposal.trackInfo.album.images[0].url}
                    alt={`${proposal.trackInfo.album.name} album cover`}
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
                <div className="song-name">{proposal.trackInfo.name}</div>
                <div className="song-artist">{formatArtists(proposal.trackInfo.artists)}</div>
              </div>

              <div className="song-status">
                {getStatusIcon(proposal.status)}
                <span className="status-text">{getStatusText(proposal.status)}</span>
                {proposal.status === 'rejected' && proposal.reason && (
                  <span className="rejection-reason" title={proposal.reason}>
                    ({proposal.reason})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 