import { useState, memo } from 'react';
import type { Player } from '../../types/types';
import './CleanGuessButtons.css';

interface GuessResult {
  isCorrect: boolean;
  correctOwnerId?: string;
  correctOwnerName?: string;
  scoreChange: number;
}

interface CleanGuessButtonsProps {
  players: { [id: string]: Player };
  excludedPlayerId: string;
  onGuess: (ownerId: string) => Promise<GuessResult>;
  disabled?: boolean;
  currentTrackName?: string;
}

export const CleanGuessButtons = memo(({ 
  players, 
  excludedPlayerId, 
  onGuess, 
  disabled = false,
  currentTrackName
}: CleanGuessButtonsProps) => {
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Get eligible players (exclude the track owner)
  const eligiblePlayers = Object.values(players)
    .filter(player => player.id !== excludedPlayerId)
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

  const handleGuess = async (playerId: string) => {
    if (disabled || pendingGuess) return;

    setPendingGuess(playerId);
    setFeedback(null);

    try {
      const result = await onGuess(playerId);
      
      if (result.isCorrect) {
        setFeedback({ 
          type: 'success', 
          message: `Correct! +${result.scoreChange} point${result.scoreChange !== 1 ? 's' : ''}` 
        });
      } else {
        const correctName = result.correctOwnerName || 'Unknown';
        setFeedback({ 
          type: 'error', 
          message: `Wrong! It was ${correctName}. ${result.scoreChange} point${Math.abs(result.scoreChange) !== 1 ? 's' : ''}!` 
        });
      }

      // Clear feedback after 4 seconds
      setTimeout(() => setFeedback(null), 4000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit guess';
      setFeedback({ type: 'error', message: errorMessage });
      setTimeout(() => setFeedback(null), 4000);
    } finally {
      setPendingGuess(null);
    }
  };

  if (eligiblePlayers.length === 0) {
    return (
      <div className="guess-section">
        <div className="no-players-message">
          <div className="no-players-icon">🎵</div>
          <p>No other players to guess from</p>
        </div>
      </div>
    );
  }

  return (
    <div className="guess-section">
      <div className="guess-header">
        <h3 className="guess-title">Who added this song?</h3>
        {currentTrackName && (
          <p className="guess-subtitle">🎵 {currentTrackName}</p>
        )}
      </div>
      
      {feedback && (
        <div className={`guess-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}
      
      <div className="guess-buttons-grid">
        {eligiblePlayers.map((player) => (
          <button
            key={player.id}
            className={`guess-button ${pendingGuess === player.id ? 'pending' : ''}`}
            onClick={() => handleGuess(player.id)}
            disabled={disabled || !!pendingGuess}
          >
            <div className="button-content">
              {pendingGuess === player.id ? (
                <div className="button-spinner">
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                  <div className="spinner-dot"></div>
                </div>
              ) : (
                <>
                  <div className="player-avatar">
                    {player.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="player-name">{player.name}</span>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

