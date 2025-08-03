import React from 'react';
import type { GameResult } from '../../types/types';
import './EndGameSummary.css';

interface Props {
  result: GameResult;
  currentUserId?: string | null;
}

export const EndGameSummary: React.FC<Props> = ({ result, currentUserId }) => {
  const { finalScores, players, winnerId, autoEnded } = result;

  const sorted = Object.entries(finalScores)
    .map(([pid, score]) => ({
      playerId: pid,
      score,
      name: players?.[pid]?.name || 'Player'
    }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="endgame-summary">
      <h2>Game Over!</h2>
      {autoEnded && (
        <p className="auto-end-message">🎉 All songs have been correctly guessed!</p>
      )}
      {winnerId && (
        <div className="winner-announcement">
          🏆 Winner: {players?.[winnerId]?.name || 'Unknown'}
        </div>
      )}
      <div className="scoreboard">
        {sorted.map(({ playerId, name, score }) => (
          <div
            key={playerId}
            className={`score-item ${playerId === winnerId ? 'winner' : ''} ${playerId === currentUserId ? 'me' : ''}`}
          >
            <span className="player-name">{name}{playerId === currentUserId ? ' (You)' : ''}</span>
            <span className="score">{score}</span>
          </div>
        ))}
      </div>
    </div>
  );
};