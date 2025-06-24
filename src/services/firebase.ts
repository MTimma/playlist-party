import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  onSnapshot, 
  collection,
  serverTimestamp,
  query,
  where,
  deleteDoc,
  increment,
  connectFirestoreEmulator
} from 'firebase/firestore';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  type User,
  connectAuthEmulator
} from 'firebase/auth';
import type { Lobby, Player, GameState, Song, Track, TrackProposal, PlaylistCollection } from '../types/types';

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

// Initialize Firebase services with emulator support
const db = getFirestore(app);
const auth = getAuth(app);

// Connect to emulators in development mode
if (import.meta.env.DEV && !import.meta.env.VITE_USE_FIREBASE_PROD) {
  try {
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    console.log('🔥 Connected to Firestore emulator');
  } catch (error) {
    console.warn('⚠️ Firestore emulator connection info:', error);
  }
  
  try {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099');
    console.log('🔥 Connected to Auth emulator');
  } catch (error) {
    console.warn('⚠️ Auth emulator connection info:', error);
  }
}

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
    score: 0,
    hasAddedSongs: false
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
      score: 0,
      hasAddedSongs: false
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

export const togglePlayerReady = async (lobbyId: string): Promise<void> => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbyDoc = await getDoc(lobbyRef);
  
  if (!lobbyDoc.exists()) {
    throw new Error('Lobby not found');
  }
  
  const lobby = lobbyDoc.data() as Lobby;
  const player = lobby.players[user.uid];
  
  if (!player) {
    throw new Error('Player not found in lobby');
  }
  
  const newReadyStatus = !player.isReady;
  
  await updateDoc(lobbyRef, {
    [`players.${user.uid}.isReady`]: newReadyStatus
  });
};

export const startGameWithPlaylist = async (lobbyId: string, playlistName: string): Promise<void> => {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbyDoc = await getDoc(lobbyRef);
  
  if (!lobbyDoc.exists()) {
    throw new Error('Lobby not found');
  }
  
  const lobby = lobbyDoc.data() as Lobby;
  
  // Verify user is host
  if (lobby.hostFirebaseUid !== user.uid) {
    throw new Error('Only the host can start the game');
  }
  
  // Verify all players are ready
  const players = Object.values(lobby.players);
  const allReady = players.every(player => player.isReady === true);
  
  if (!allReady) {
    throw new Error('All players must be ready before starting the game');
  }
  
  // Update lobby status and trigger Cloud Function
  await updateDoc(lobbyRef, {
    status: 'in_progress',
    playlistName: playlistName,
    startedAt: new Date()
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

export const startGame = async (lobbyId: string): Promise<void> => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, { 
    status: 'in_progress',
    currentRound: 1
  });
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

// Track Proposal functions
export const addTrackProposal = async (
  lobbyId: string, 
  userId: string, 
  track: Track
): Promise<void> => {
  // Encode the Spotify URI to be safe as a Firebase document ID
  const encodedTrackUri = encodeURIComponent(track.uri);
  const proposalRef = doc(db, 'lobbies', lobbyId, 'proposals', encodedTrackUri);
  
  console.log('Creating proposal document:', {
    lobbyId,
    userId,
    trackUri: track.uri,
    encodedTrackUri,
    proposalPath: `lobbies/${lobbyId}/proposals/${encodedTrackUri}`
  });
  
  const proposal: TrackProposal = {
    trackUri: track.uri,
    proposedBy: userId,
    trackInfo: track,
    status: 'pending',
    proposedAt: new Date()
  };

  await setDoc(proposalRef, {
    ...proposal,
    proposedAt: serverTimestamp()
  });
};

export const subscribeTrackProposals = (
  lobbyId: string, 
  userId: string, 
  callback: (proposals: TrackProposal[]) => void
) => {
  const proposalsRef = collection(db, 'lobbies', lobbyId, 'proposals');
  const userProposalsQuery = query(proposalsRef, where('proposedBy', '==', userId));
  
  return onSnapshot(userProposalsQuery, (snapshot) => {
    const proposals: TrackProposal[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      proposals.push({
        ...data,
        proposedAt: data.proposedAt?.toDate() || new Date()
      } as TrackProposal);
    });
    callback(proposals);
  });
};

export const updateTrackProposalStatus = async (
  lobbyId: string, 
  trackUri: string, 
  status: TrackProposal['status'],
  reason?: string
): Promise<void> => {
  const encodedTrackUri = encodeURIComponent(trackUri);
  const proposalRef = doc(db, 'lobbies', lobbyId, 'proposals', encodedTrackUri);
  
  const updateData: Partial<TrackProposal> = { status };
  if (reason) {
    updateData.reason = reason;
  }
  
  await updateDoc(proposalRef, updateData);
};

export const deleteTrackProposal = async (
  lobbyId: string, 
  trackUri: string
): Promise<void> => {
  const encodedTrackUri = encodeURIComponent(trackUri);
  const proposalRef = doc(db, 'lobbies', lobbyId, 'proposals', encodedTrackUri);
  await deleteDoc(proposalRef);
};

// Playlist Collection functions
export const createPlaylistCollection = async (
  lobbyId: string, 
  playlistId: string
): Promise<void> => {
  const collectionRef = doc(db, 'playlists', lobbyId);
  
  const collection: PlaylistCollection = {
    lobbyId,
    playlistId,
    songs: {},
    stats: {
      totalSongs: 0,
      playersWithSongs: 0
    }
  };

  await setDoc(collectionRef, collection);
};

// Get count of players who have added songs
export const getPlayersWithSongsCount = async (lobbyId: string): Promise<number> => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbyDoc = await getDoc(lobbyRef);
  
  if (!lobbyDoc.exists()) {
    return 0;
  }
  
  const lobby = lobbyDoc.data() as Lobby;
  const playersWithSongs = Object.values(lobby.players || {}).filter(
    player => player.hasAddedSongs === true
  ).length;
  
  return playersWithSongs;
};

// Update stats when a player adds their first song
export const updatePlaylistStats = async (lobbyId: string, addedBy: string): Promise<void> => {
  // First, check if this is the player's first song
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  const lobbyDoc = await getDoc(lobbyRef);
  
  if (!lobbyDoc.exists()) {
    return;
  }
  
  const lobby = lobbyDoc.data() as Lobby;
  const player = lobby.players[addedBy];
  const isFirstSong = !player?.hasAddedSongs;
  
  // Update player status
  await updateDoc(lobbyRef, {
    [`players.${addedBy}.hasAddedSongs`]: true
  });
  
  // Update playlist stats
  const collectionRef = doc(db, 'playlists', lobbyId);
  const updateData: Record<string, any> = {
    'stats.totalSongs': increment(1)
  };
  
  // Only increment playersWithSongs if this is their first song
  if (isFirstSong) {
    updateData['stats.playersWithSongs'] = increment(1);
  }
  
  await updateDoc(collectionRef, updateData);
};

export const addTrackToPlaylist = async (
  lobbyId: string, 
  trackUri: string, 
  addedBy: string, 
  trackInfo: Track
): Promise<void> => {
  const collectionRef = doc(db, 'playlists', lobbyId);
  
  await updateDoc(collectionRef, {
    [`songs.${trackUri}`]: {
      addedBy,
      trackInfo,
      addedAt: serverTimestamp()
    }
  });
  
  // Update stats atomically
  await updatePlaylistStats(lobbyId, addedBy);
};

export const subscribePlaylistCollection = (
  lobbyId: string, 
  callback: (collection: PlaylistCollection | null) => void
) => {
  const collectionRef = doc(db, 'playlists', lobbyId);
  
  return onSnapshot(collectionRef, (doc) => {
    if (doc.exists()) {
      const data = doc.data();
      
      // Convert timestamps to dates
      const collection: PlaylistCollection = {
        ...data,
        songs: Object.fromEntries(
          Object.entries(data.songs || {}).map(([uri, songData]: [string, unknown]) => [
            uri,
            {
              ...songData,
              addedAt: songData.addedAt?.toDate() || new Date()
            }
          ])
        )
      } as PlaylistCollection;
      
      callback(collection);
    } else {
      callback(null);
    }
  });
}; 