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

import type { Lobby, Player, LegacyGameState, Song, Track, TrackProposal, PlaylistCollection, PlayerScore } from '../types/types';

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
  // Ensure user is authenticated
  await signInAnonymouslyIfNeeded();
  
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

  // Get all songs from the playlist collection
  const playlistRef = doc(db, 'playlists', lobbyId);
  const playlistDoc = await getDoc(playlistRef);

  if (!playlistDoc.exists()) {
    throw new Error('Playlist collection not found');
  }

  const playlistData = playlistDoc.data() as PlaylistCollection;
  const trackUris: string[] = Object.keys(playlistData.songs || {});

  if (trackUris.length === 0) {
    throw new Error('No tracks have been added to the playlist');
  }

  // Create playlist via Express server
  const backendUrl = import.meta.env.VITE_BACKEND_URL;
  if (!backendUrl) {
    throw new Error('Server not configured');
  }
  
  const response = await fetch(`${backendUrl}/api/spotify/playlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include', // Include cookies for authentication
    body: JSON.stringify({
      name: playlistName,
      description: `Playlist created for Music Game lobby ${lobbyId} with ${players.length} players`,
      trackUris: trackUris,
      lobbyId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create playlist');
  }

  const result = await response.json();

  // Update lobby with playlist information and status
  
  await updateDoc(lobbyRef, {
    status: 'in_progress',
    playlistName: playlistName,
    playlistId: result.playlist.id,
    snapshotId: result.playlist.snapshot_id,
    startedAt: new Date()
  });

  // Initialize game state in lobby
  await initializeGameStateInLobby(lobbyId, trackUris);

  // Create playlist collection document for tracking
  await setDoc(doc(db, 'playlists', lobbyId), {
    lobbyId,
    playlistId: result.playlist.id,
    snapshotId: result.playlist.snapshot_id,
    updatedAt: serverTimestamp(),
    trackCount: trackUris.length,
    playerCount: players.length,
  }, {merge: true});
};

// Initialize game state in lobby when game starts
export const initializeGameStateInLobby = async (
  lobbyId: string, 
  trackUris: string[]
): Promise<void> => {
  if (trackUris.length === 0) {
    throw new Error('No tracks available for game');
  }

  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, {
    isPlaying: false,
    guessWindowMs: 30000, // 30 seconds
    disableGuessing: false,
    playerScores: {}
  });
};

export const createGame = async (host: Player): Promise<string> => {
  const gameRef = doc(collection(db, 'games'));
  const gameId = gameRef.id;
  
  const gameState: LegacyGameState = {
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
    const game = gameDoc.data() as LegacyGameState;
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
    const game = gameDoc.data() as LegacyGameState;
    const updatedPlaylist = [...game.playlist, song];
    await updateDoc(gameRef, { playlist: updatedPlaylist });
  }
};

export const updateGameState = async (lobbyId: string, updates: Partial<Lobby>) => {
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  await updateDoc(lobbyRef, updates);
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
  // Ensure user is authenticated
  await signInAnonymouslyIfNeeded();
  
  const collectionRef = doc(db, 'playlists', lobbyId);
  
  const collection: PlaylistCollection = {
    lobbyId,
    createdAt: new Date(),
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
  
  if (isFirstSong) {
    await updateDoc(collectionRef, {
      'stats.totalSongs': increment(1),
      'stats.playersWithSongs': increment(1)
    });
  } else {
    await updateDoc(collectionRef, {
      'stats.totalSongs': increment(1)
    });
  }
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
              ...songData as Record<string, unknown>,
              addedAt: (() => {
                const addedAt = (songData as Record<string, unknown>).addedAt;
                if (addedAt && typeof addedAt === 'object' && 'toDate' in addedAt) {
                  return (addedAt as { toDate(): Date }).toDate();
                }
                return new Date();
              })()
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

// Game state is now part of lobby, so we use subscribeLobby instead

export const getTrackInfo = async (/* trackUri: string */): Promise<Track | null> => {
  // TODO: Implement Spotify API call to get track info
  return null;
};

export const getTrackOwner = async (lobbyId: string, trackUri: string): Promise<string | null> => {
  const collectionRef = doc(db, 'playlists', lobbyId);
  const collectionDoc = await getDoc(collectionRef);
  
  if (!collectionDoc.exists()) {
    return null;
  }
  
  const collection = collectionDoc.data() as PlaylistCollection;
  const songData = collection.songs[trackUri];
  
  return songData?.addedBy || null;
};



export const subscribePlayerScores = (
  lobbyId: string,
  callback: (scores: PlayerScore[]) => void
) => {
  const scoresRef = collection(db, 'games', lobbyId, 'scores');
  
  return onSnapshot(scoresRef, (snapshot) => {
    const scores: PlayerScore[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      scores.push({
        playerId: data.playerId,
        score: data.score
      } as PlayerScore);
    });
    callback(scores);
  });
};

export const subscribeUserSongs = (
  lobbyId: string,
  userId: string,
  cb: (tracks: Track[]) => void,
) => {
  const ref = doc(db, 'playlists', lobbyId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { cb([]); return; }
    const songs = snap.data().songs ?? {};
    cb(
      Object.values(songs)
        .filter((s: any) => s.addedBy === userId)
        .map((s: any) => ({ ...s.trackInfo } as Track))
    );
  });
};

export const verifyHostStatus = async (lobbyId: string): Promise<boolean> => {
  const user = await signInAnonymouslyIfNeeded();
  const lobbyRef = doc(db, 'lobbies', lobbyId);
  
  try {
    const lobbyDoc = await getDoc(lobbyRef);
    if (!lobbyDoc.exists()) {
      return false;
    }
    
    const lobby = lobbyDoc.data() as Lobby;
    return lobby.hostFirebaseUid === user.uid;
  } catch (error) {
    console.error('Error verifying host status:', error);
    return false;
  }
};
