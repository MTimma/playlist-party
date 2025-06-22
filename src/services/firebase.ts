import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  collection,
  serverTimestamp
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  type User
} from 'firebase/auth';
import type { Lobby, Player, GameState, Song } from '../types/types';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Auth functions
export const signInAnonymouslyIfNeeded = async (): Promise<User> => {
  return new Promise((resolve, reject) => {
    let unsubscribe: (() => void) | null = null;
    
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (unsubscribe) unsubscribe();
      if (user) {
        resolve(user);
      } else {
        signInAnonymously(auth)
          .then(result => resolve(result.user))
          .catch(reject);
      }
    });
  });
};

export const getCurrentUser = () => auth.currentUser;

// Lobby functions
export const createLobby = async (
  hostName: string, 
  hostSpotifyUserId: string,
  maxPlayers: number = 8
): Promise<string> => {
  const user = await signInAnonymouslyIfNeeded();
  
  const lobbyRef = doc(collection(db, 'lobbies'));
  const lobbyId = lobbyRef.id;
  
  const hostPlayer: Player = {
    id: user.uid,
    name: hostName,
    isHost: true,
    joinedAt: new Date(),
    score: 0
  };

  const lobby: Lobby = {
    id: lobbyId,
    hostFirebaseUid: user.uid,
    hostSpotifyUserId,
    status: 'waiting',
    createdAt: new Date(),
    maxPlayers,
    players: {
      [user.uid]: hostPlayer
    }
  };

  await setDoc(lobbyRef, {
    ...lobby,
    createdAt: serverTimestamp()
  });
  
  return lobbyId;
};

export const joinLobby = async (lobbyId: string, playerName: string): Promise<boolean> => {
  const user = await signInAnonymouslyIfNeeded();
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  
  try {
    const lobbyDoc = await getDoc(lobbyRef);
    if (!lobbyDoc.exists()) {
      throw new Error('Lobby not found');
    }
    
    const lobby = lobbyDoc.data() as Lobby;
    
    if (lobby.status !== 'waiting') {
      throw new Error('Lobby is not accepting new players');
    }
    
    const playerCount = Object.keys(lobby.players || {}).length;
    if (playerCount >= lobby.maxPlayers) {
      throw new Error('Lobby is full');
    }
    
    if (lobby.players[user.uid]) {
      throw new Error('Player already in lobby');
    }
    
    const newPlayer: Player = {
      id: user.uid,
      name: playerName,
      isHost: false,
      joinedAt: new Date(),
      score: 0
    };
    
    await updateDoc(lobbyRef, {
      [`players.${user.uid}`]: newPlayer
    });
    
    return true;
  } catch (error) {
    console.error('Error joining lobby:', error);
    throw error;
  }
};

export const getLobby = async (lobbyId: string): Promise<Lobby | null> => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbyDoc = await getDoc(lobbyRef);
  
  if (!lobbyDoc.exists()) {
    return null;
  }
  
  const data = lobbyDoc.data();
  if (!data) {
    return null;
  }
  
  return {
    ...data,
    createdAt: data.createdAt?.toDate() || new Date()
  } as Lobby;
};

export const subscribeLobby = (lobbyId: string, callback: (lobby: Lobby | null) => void) => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  
  return onSnapshot(lobbyRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      const lobby: Lobby = {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date()
      } as Lobby;
      callback(lobby);
    } else {
      callback(null);
    }
  });
};

export const updateLobbyStatus = async (lobbyId: string, status: Lobby['status']) => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, { status });
};

export const leaveLobby = async (lobbyId: string) => {
  const user = getCurrentUser();
  if (!user) return;
  
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, {
    [`players.${user.uid}`]: null
  });
};

// Legacy functions for backward compatibility
export const createGame = async (host: Player): Promise<string> => {
  const gameRef = doc(collection(db, 'games'));
  const gameId = gameRef.id;
  
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

  await setDoc(gameRef, gameState);
  return gameId;
};

export const joinGame = async (gameId: string, player: Player) => {
  const gameRef = doc(db, 'games', gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (gameDoc.exists()) {
    const game = gameDoc.data() as GameState;
    if (game.status === 'waiting') {
      const updatedPlayers = [...game.players, player];
      await updateDoc(gameRef, { players: updatedPlayers });
    }
  }
};

export const addSong = async (gameId: string, song: Song) => {
  const gameRef = doc(db, 'games', gameId);
  const gameDoc = await getDoc(gameRef);
  
  if (gameDoc.exists()) {
    const game = gameDoc.data() as GameState;
    const updatedPlaylist = [...game.playlist, song];
    await updateDoc(gameRef, { playlist: updatedPlaylist });
  }
};

export const startGame = async (gameId: string) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, { status: 'playing', round: 1 });
};

export const updateGameState = async (gameId: string, updates: Partial<GameState>) => {
  const gameRef = doc(db, 'games', gameId);
  await updateDoc(gameRef, updates);
};

export const subscribeToGame = (gameId: string, callback: (game: GameState) => void) => {
  const gameRef = doc(db, 'games', gameId);
  return onSnapshot(gameRef, (doc) => {
    if (doc.exists()) {
      const game = doc.data() as GameState;
      callback(game);
    }
  });
}; 