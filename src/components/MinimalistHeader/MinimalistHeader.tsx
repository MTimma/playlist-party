import { memo } from 'react';
import type { Lobby } from '../../types/types';
import './MinimalistHeader.css';

interface MinimalistHeaderProps {
  lobby: Lobby | null;
  currentUserId: string | null;
  playerScores: Record<string, number>;
  remainingMs: number | null;
  isHost: boolean;
  onEndGame: () => void;
  isEndingGame: boolean;
}

const formatTime = (ms: number | null): string => {
  if (ms === null) return '';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

export const MinimalistHeader = memo(({
  lobby,
  currentUserId,
  playerScores,
  remainingMs,
  isHost,
  onEndGame,
  isEndingGame
}: MinimalistHeaderProps) => {
  if (!lobby?.players) return null;

  // Sort players by score (descending) then by name (ascending)
  const sortedPlayers = Object.entries(lobby.players)
    .map(([playerId, player]) => ({
      playerId,
      player,
      score: playerScores[playerId] || 0,
      isCurrentPlayer: playerId === currentUserId,
      isHost: player.isHost
    }))
    .sort((a, b) => {
      if (a.score !== b.score) {
        return b.score - a.score;
      }
      return a.player.name.localeCompare(b.player.name);
    });

  return (
    <div className="minimalist-header">
      <div className="header-card">
        <div className="scoreboard">
          {sortedPlayers.map(({ playerId, player, score, isCurrentPlayer, isHost }) => (
            <div 
              key={playerId}
              className={`score-item ${isCurrentPlayer ? 'current-player' : ''} ${isHost ? 'host' : ''}`}
            >
              <div className="player-info">
                <span className="player-name">
                  {player.name}
                  {isCurrentPlayer && ' (You)'}
                  {isHost && ' 👑'}
                </span>
              </div>
              <div className="player-score">{score}</div>
            </div>
          ))}
        </div>

        {isHost && (
          <div className="end-game-section">
            <button 
              className="end-game-btn" 
              onClick={onEndGame}
              disabled={isEndingGame}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-3 7h6v6H9V9z" />
              </svg>
              <span>{isEndingGame ? 'Ending…' : 'End Party'}</span>
            </button>
            
            {remainingMs !== null && (
              <div className={`timer-display ${remainingMs === 0 ? 'expired' : ''}`}>
                ⏳ {formatTime(remainingMs)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

