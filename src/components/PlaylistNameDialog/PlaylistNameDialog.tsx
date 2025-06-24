import { useState, useRef, useEffect } from 'react';
import './PlaylistNameDialog.css';

interface PlaylistNameDialogProps {
  isOpen: boolean;
  lobbyId: string;
  defaultName?: string;
  onConfirm: (playlistName: string) => void;
  onCancel: () => void;
}

export const PlaylistNameDialog = ({ 
  isOpen, 
  lobbyId, 
  defaultName, 
  onConfirm, 
  onCancel 
}: PlaylistNameDialogProps) => {
  const [playlistName, setPlaylistName] = useState(defaultName || `Music Game - Lobby ${lobbyId}`);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = playlistName.trim();
    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
      return;
    }

    setIsLoading(true);
    try {
      await onConfirm(trimmedName);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="playlist-name-dialog-overlay" onClick={onCancel}>
      <div className="playlist-name-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3 className="dialog-title">Name Your Playlist</h3>
          <button
            className="close-button"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Close dialog"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="dialog-form">
          <div className="form-group">
            <label htmlFor="playlist-name" className="form-label">
              Playlist Name
            </label>
            <input
              ref={inputRef}
              id="playlist-name"
              type="text"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              onKeyDown={handleKeyDown}
              className="form-input"
              placeholder="Enter playlist name..."
              maxLength={100}
              disabled={isLoading}
              data-testid="playlist-name-input"
            />
            <div className="character-count">
              {playlistName.length}/100
            </div>
          </div>

          <div className="dialog-actions">
            <button
              type="button"
              onClick={onCancel}
              className="cancel-button"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="confirm-button"
              disabled={
                isLoading || 
                playlistName.trim().length < 1 || 
                playlistName.trim().length > 100
              }
              data-testid="confirm-button"
            >
              {isLoading ? (
                <>
                  <div className="loading-spinner" />
                  Starting Game...
                </>
              ) : (
                'Start Game'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 