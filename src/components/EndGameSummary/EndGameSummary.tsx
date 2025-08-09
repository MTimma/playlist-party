import React from 'react';
import type { GameResult } from '../../types/types';
import './EndGameSummary.css';

interface Props {
  result: GameResult;
  currentUserId?: string | null;
}

export const EndGameSummary: React.FC<Props> = ({ result, currentUserId }) => {
  const { finalScores, players, winnerIds, autoEnded } = result;

  const sorted = Object.entries(finalScores)
    .map(([pid, score]) => ({
      playerId: pid,
      score,
      name: players?.[pid]?.name || 'Player'
    }))
    // Sort players alphabetically by name
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="endgame-summary">
      <h2>Game Over!</h2>
      {autoEnded && (
        <p className="auto-end-message">🎉 All songs have been correctly guessed!</p>
      )}
      {winnerIds && winnerIds.length > 0 && (
        <div className="winner-announcement">
          🏆 Winner{winnerIds.length > 1 ? 's' : ''}: {winnerIds.map((id) => players?.[id]?.name || 'Unknown').join(', ')}
        </div>
      )}
      <div className="scoreboard">
        {sorted.map(({ playerId, name, score }) => (
          <div
            key={playerId}
            className={`score-item ${winnerIds.includes(playerId) ? 'winner' : ''} ${playerId === currentUserId ? 'me' : ''}`}
          >
            <span className="player-name">{name}{playerId === currentUserId ? ' (You)' : ''}</span>
            <span className="score">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};