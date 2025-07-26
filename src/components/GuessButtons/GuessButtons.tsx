import { useState } from 'react';
import type { Player } from '../../types/types';
import './GuessButtons.css';

interface GuessResult {
  isCorrect: boolean;
  correctOwnerId?: string;
  correctOwnerName?: string;
  scoreChange: number;
}

interface GuessButtonsProps {
  players: { [id: string]: Player };
  excludedPlayerId: string;
  onGuess: (ownerId: string) => Promise<GuessResult>;
  disabled?: boolean;
}

export const GuessButtons = ({ 
  players, 
  excludedPlayerId, 
  onGuess, 
  disabled = false 
}: GuessButtonsProps) => {
  const [pendingGuess, setPendingGuess] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Get eligible players (exclude the track owner)
  const eligiblePlayers = Object.values(players).filter(
    player => player.id !== excludedPlayerId
  );

  const handleGuess = async (playerId: string) => {
    if (disabled || pendingGuess) return;

    setPendingGuess(playerId);
    setFeedback(null);

    try {
      const result = await onGuess(playerId);
      
      if (result.isCorrect) {
        setFeedback({ type: 'success', message: `Correct! +${result.scoreChange} point${result.scoreChange !== 1 ? 's' : ''}` });
      } else {
        const correctName = result.correctOwnerName || 'Unknown';
        setFeedback({ type: 'error', message: `Wrong! It was ${correctName}` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to submit guess';
      setFeedback({ type: 'error', message: errorMessage });
    } finally {
      setPendingGuess(null);
    }
  };

  if (eligiblePlayers.length === 0) {
    return (
      <div className="guess-buttons-container">
        <p className="no-players-message">No players available to guess</p>
      </div>
    );
  }

  return (
    <div className="guess-buttons-container">
      <h3 className="guess-title">Who added this song?</h3>
      
      <div className="guess-buttons-grid">
        {eligiblePlayers.map((player) => (
          <button
            key={player.id}
            className={`guess-button ${pendingGuess === player.id ? 'pending' : ''}`}
            onClick={() => handleGuess(player.id)}
            disabled={disabled || !!pendingGuess}
          >
            {pendingGuess === player.id ? (
              <span className="button-spinner"></span>
            ) : (
              player.name
            )}
          </button>
        ))}
      </div>

      {feedback && (
        <div className={`guess-feedback ${feedback.type}`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
}; 