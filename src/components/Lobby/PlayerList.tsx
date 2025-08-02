import type { Player } from '../../types/types';
import { Timestamp } from 'firebase/firestore';
import './PlayerList.css';

interface PlayerListProps {
  players: { [playerId: string]: Player };
  maxPlayers: number;
  currentUserId?: string;
}

export const PlayerList = ({ players, maxPlayers, currentUserId }: PlayerListProps) => {
  const playerArray = Object.values(players);
  const currentPlayerCount = playerArray.length;

  const formatJoinTime = (joinedAt: Date | Timestamp) => {
    const now = new Date();
    // Handle both Date objects and Firestore Timestamps
    let joinTime: Date;
    
    if (joinedAt && typeof joinedAt === 'object' && 'toDate' in joinedAt) {
      // Firestore Timestamp
      joinTime = joinedAt.toDate();
    } else if (joinedAt instanceof Date) {
      joinTime = joinedAt;
    } else if (typeof joinedAt === 'string' || typeof joinedAt === 'number') {
      // Handle string dates or timestamps
      joinTime = new Date(joinedAt);
    } else {
      // Fallback for unknown formats
      return 'Just joined';
    }
    
    // Validate that we have a valid date
    if (isNaN(joinTime.getTime())) {
      return 'Just joined';
    }
    
    const diffInSeconds = Math.floor((now.getTime() - joinTime.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just joined';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  const getPlayerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .slice(0, 2)
      .join('');
  };

  return (<>
    <div className="player-list-header">
        <h3 className="player-list-title">Players</h3>
        <div className="player-count">
          <span className="current-count">{currentPlayerCount}</span>
          <span className="count-separator">/</span>
          <span className="max-count">{maxPlayers}</span>
        </div>
      </div>
    <div className="player-list">
      

      <div className="players-grid">
        {playerArray.map((player) => (
          <div
            key={player.id}
            className={`player-card ${player.isHost ? 'host' : ''} ${
              player.id === currentUserId ? 'current-user' : ''
            }`}
          >
            <div className="player-avatar">
              {player.avatarUrl ? (
                <img
                  src={player.avatarUrl}
                  alt={`${player.name}'s avatar`}
                  className="avatar-image"
                />
              ) : (
                <div className="avatar-placeholder">
                  {getPlayerInitials(player.name)}
                </div>
              )}
              {player.isHost && (
                <div className="host-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                  </svg>
                </div>
              )}
            </div>
            
            <div className="player-info">
              <div className="player-name">
                {player.name}
                {player.id === currentUserId && (
                  <span className="you-indicator">(You)</span>
                )}
              </div>
              <div className="player-meta">
                {player.isHost ? (
                  <span className="host-label">Host</span>
                ) : (
                  <span className="join-time">
                    {formatJoinTime(player.joinedAt)}
                  </span>
                )}
              </div>
            </div>

            <div className="player-status">
              {player.isReady ? (
                <div className="ready-indicator" title="Ready">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span className="status-label">Ready</span>
                </div>
              ) : (
                <div className="not-ready-indicator" title="Not ready">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
                  </svg>
                  <span className="status-label">Not Ready</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: maxPlayers - currentPlayerCount }).map((_, index) => (
          <div key={`empty-${index}`} className="player-card empty">
            <div className="player-avatar">
              <div className="avatar-placeholder empty">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            </div>
            <div className="player-info">
              <div className="player-name empty">Waiting for player...</div>
            </div>
          </div>
        ))}
      </div>

      {currentPlayerCount >= maxPlayers && (
        <div className="lobby-full-notice">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
          </svg>
          Lobby is full
        </div>
      )}
    </div>
  </>);
}; 