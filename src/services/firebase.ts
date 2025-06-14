import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, push, update } from 'firebase/database';
import type { GameState, Player, Song } from '../types';

const firebaseConfig = {
  // TODO: Replace with your Firebase config
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const createGame = async (host: Player): Promise<string> => {
  const gameRef = push(ref(database, 'games'));
  const gameId = gameRef.key!;
  
  const gameState: GameState = {
    id: gameId,
    host,
    players: [host],
    playlist: [],
    currentSong: null,
    status: 'waiting',
    round: 0,
    maxRounds: 10
  };

  await set(gameRef, gameState);
  return gameId;
};

export const joinGame = async (gameId: string, player: Player) => {
  const gameRef = ref(database, `games/${gameId}`);
  const gameSnapshot = await onValue(gameRef, (snapshot) => {
    const game = snapshot.val() as GameState;
    if (game.status === 'waiting') {
      const updatedPlayers = [...game.players, player];
      update(gameRef, { players: updatedPlayers });
    }
  }, { once: true });
};

export const addSong = async (gameId: string, song: Song) => {
  const gameRef = ref(database, `games/${gameId}`);
  const gameSnapshot = await onValue(gameRef, (snapshot) => {
    const game = snapshot.val() as GameState;
    const updatedPlaylist = [...game.playlist, song];
    update(gameRef, { playlist: updatedPlaylist });
  }, { once: true });
};

export const startGame = async (gameId: string) => {
  const gameRef = ref(database, `games/${gameId}`);
  update(gameRef, { status: 'playing', round: 1 });
};

export const updateGameState = async (gameId: string, updates: Partial<GameState>) => {
  const gameRef = ref(database, `games/${gameId}`);
  update(gameRef, updates);
};

export const subscribeToGame = (gameId: string, callback: (game: GameState) => void) => {
  const gameRef = ref(database, `games/${gameId}`);
  return onValue(gameRef, (snapshot) => {
    const game = snapshot.val() as GameState;
    callback(game);
  });
}; 