import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { subscribeToGame, updateGameState, joinGame } from '../../services/firebase';
import { playSong, pauseSong } from '../../services/spotify';
import type { GameState, Player } from '../../types/types';
import './Game.css';

export const Game = () => {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerName, setPlayerName] = useState('');
  const [joining, setJoining] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const isHost = location.search.includes('host=1');

  useEffect(() => {
    if (!gameId) return;
    const unsubscribe = subscribeToGame(gameId, (game) => {
      setGameState(game);
    });
    return () => unsubscribe();
  }, [gameId]);

  // Store playerId in localStorage for session persistence
  useEffect(() => {
    const storedId = localStorage.getItem(`playerId_${gameId}`);
    if (storedId) setPlayerId(storedId);
  }, [gameId]);

  const handleJoin = async () => {
    if (!playerName.trim() || !gameId) return;
    setJoining(true);
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: playerName,
      isHost: false,
      score: 0
    };
    await joinGame(gameId, newPlayer);
    setPlayerId(newPlayer.id);
    localStorage.setItem(`playerId_${gameId}`, newPlayer.id);
    setJoining(false);
  };

  const handleStartGame = async () => {
    if (!gameId) return;
    await updateGameState(gameId, { status: 'playing', round: 1, currentSong: gameState?.playlist[0] || null });
  };

  const handlePlaySong = async () => {
    if (!gameState?.currentSong) return;
    await playSong(gameState.currentSong.uri);
    setIsPlaying(true);
  };

  const handlePauseSong = async () => {
    await pauseSong();
    setIsPlaying(false);
  };

  const handleGuess = async (guessPlayerId: string) => {
    if (!gameState || !gameState.currentSong) return;
    const isCorrect = guessPlayerId === gameState.currentSong.addedBy;
    const updatedPlayers = gameState.players.map(player => {
      if (player.id === guessPlayerId && isCorrect) {
        return { ...player, score: player.score + 1 };
      }
      return player;
    });
    await updateGameState(gameId!, {
      players: updatedPlayers,
      round: gameState.round + 1,
      currentSong: gameState.playlist[gameState.round] || null
    });
    setSelectedPlayer(null);
    setIsPlaying(false);
  };

  if (!gameState) {
    return <div className="loading">Loading game...</div>;
  }

  // Waiting room logic
  if (gameState.status === 'waiting') {
    // If not host and not joined, show join form
    if (!isHost && !playerId) {
      return (
        <div className="game-container">
          <h2>Join Game</h2>
          <input
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name"
            className="lobby-input"
            disabled={joining}
          />
          <button onClick={handleJoin} className="lobby-button" disabled={joining || !playerName.trim()}>
            {joining ? 'Joining...' : 'Join Game'}
          </button>
        </div>
      );
    }
    // Waiting room for all
    return (
      <div className="game-container">
        <h2>Waiting for players...</h2>
        <div className="player-scores">
          {gameState.players.map(player => (
            <div key={player.id} className="player-score">
              <span>{player.name}</span>
            </div>
          ))}
        </div>
        {isHost && (
          <button className="lobby-button mt-8" onClick={handleStartGame} disabled={!canStartGame()}>
            Start Game
          </button>
        )}
      </div>
    );
  }

  // Game in progress
  return (
    <div className="game-container">
      <div className="game-header">
        <h1>Round {gameState.round} of {gameState.maxRounds}</h1>
        <div className="player-scores">
          {gameState.players.map(player => (
            <div key={player.id} className="player-score">
              <span>{player.name}</span>
              <span>{player.score}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="game-content">
        {gameState.currentSong && (
          <div className="current-song">
            <h2>Now Playing</h2>
            <p>{gameState.currentSong.name}</p>
            <p>{gameState.currentSong.artist}</p>
            <div className="song-controls">
              {!isPlaying ? (
                <button onClick={handlePlaySong} className="play-button">
                  Play
                </button>
              ) : (
                <button onClick={handlePauseSong} className="pause-button">
                  Pause
                </button>
              )}
            </div>
          </div>
        )}
        <div className="player-guesses">
          <h2>Who added this song?</h2>
          <div className="player-list">
            {gameState.players.map(player => (
              <button
                key={player.id}
                onClick={() => handleGuess(player.id)}
                className={`player-button ${selectedPlayer === player.id ? 'selected' : ''}`}
                disabled={isPlaying}
              >
                {player.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  function canStartGame(): boolean {
    if(!gameState?.players) return false;
    return gameState.players.length >=2 && gameState.players.every(player => player.isReady === true);
  }
}; 