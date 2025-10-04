import { useState } from 'react';
import './ReadyButton.css';

interface ReadyButtonProps {
  isReady: boolean;
  onToggleReady: () => void;
  disabled?: boolean;
}

export const ReadyButton = ({ isReady, onToggleReady, disabled = false }: ReadyButtonProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || isLoading) return;
    
    setIsLoading(true);
    try {
      await onToggleReady();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`ready-button ${isReady ? 'ready' : 'not-ready'} ${isLoading ? 'loading' : ''}`}
      onClick={handleToggle}
      disabled={disabled || isLoading}
      data-testid="ready-button"
    >
      {isLoading ? (
        <div className="loading-spinner" />
      ) : (
        <>
          <div className="ready-icon">
            {isReady ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
              </svg>
            )}
          </div>
          <span className="ready-text">
            {isReady ? 'Ready!' : 'Press to ready'}
          </span>
        </>
      )}
    </button>
  );
}; 