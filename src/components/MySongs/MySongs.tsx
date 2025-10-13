import { useState, useEffect } from 'react';
import { subscribeUserSongs, removeTrackFromPlaylist, updateTrackComment } from '../../services/firebase';
import type { Track } from '../../types/types';
import './MySongs.css';

interface MySongsProps {
  lobbyId: string;
  userId: string;
}

export const MySongs = ({ lobbyId, userId }: MySongsProps) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isExpanded] = useState(true);
  const [activeCommentUri, setActiveCommentUri] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<string>('');
  const [commentPrompt, setCommentPrompt] = useState<string>('');

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
          <p>You have not added any songs yet</p>
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
      {/* <div className="my-songs-header" onClick={() => setIsExpanded(!isExpanded)}> */}
      <div className="my-songs-header" >
        <div className="header-content">
          Your songs
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
            <div className="song-item-group" key={track.uri}>
            <div className="song-item">
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

              <button
                type="button"
                className="preview-btn"
                aria-label="Add note"
                title="Add note"
                onClick={() => { setActiveCommentUri(track.uri); setCommentText(''); setCommentPrompt(''); }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z" />
                </svg>
              </button>

              <button
                type="button"
                className="remove-btn"
                aria-label="Remove from playlist"
                title="Remove from playlist"
                onClick={async () => {
                  try {
                    await removeTrackFromPlaylist(lobbyId, track.uri, userId);
                  } catch (e) {
                    console.error('Failed to remove track', e);
                  }
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zm3-9h2v7H9V10zm4 0h2v7h-2V10zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>

              {/* <div className="song-status">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="status-icon approved">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
                <span className="status-text">Added to playlist</span>
              </div> */}
            </div>

            {activeCommentUri === track.uri && (
              <div className="comment-inline">
                <div className="comment-header">Add a hint</div>
                <div className="comment-body">
                  <label className="form-label">Prompt</label>
                  <select className="form-input" value={commentPrompt} onChange={(e)=>setCommentPrompt(e.target.value)}>
                    <option value="">(none)</option>
                    <option value="first_heard">What were you doing when you first heard this song?</option>
                    <option value="reminds_who">Who does this song remind you of?</option>
                    <option value="heard_where">Where did you hear it?</option>
                    <option value="why_special">Why is it special?</option>
                  </select>
                  <label className="form-label">Your note</label>
                  <textarea className="form-input" rows={4} value={commentText} onChange={(e)=>setCommentText(e.target.value)} />
                </div>
                <div className="comment-actions">
                  <button className="btn-secondary" onClick={()=>setActiveCommentUri(null)}>Cancel</button>
                  <button className="btn-primary" onClick={async ()=>{
                    try {
                      await updateTrackComment(lobbyId, track.uri, { text: commentText, promptKey: commentPrompt });
                      setActiveCommentUri(null);
                    } catch (e) { console.error('Failed to save note', e); }
                  }}>Save</button>
                </div>
              </div>
            )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}; 