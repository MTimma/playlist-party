import { Timestamp } from 'firebase/firestore';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date | Timestamp;
  score: number;
  avatarUrl?: string;
  hasAddedSongs?: boolean;
  isReady?: boolean;  // NEW - Player readiness for game start
}

export interface Track {
  uri: string;
  name: string;
  artists: Array<{name: string, id: string}>;
  duration_ms: number;
  preview_url?: string;
  album: {
    name: string;
    images: Array<{url: string, height: number, width: number}>;
  };
}

// NEW - Spotify user profile information returned by the backend `/me` endpoint
export interface SpotifyUser {
  id: string;
  display_name: string;
  images: Array<{ url: string }>;
}

export interface Lobby {
  id: string;
  hostFirebaseUid: string;
  hostSpotifyUserId: string;
  playlistId?: string;
  playlistName?: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished' | 'terminated_by_host';
  createdAt: Date | Timestamp;
  startedAt?: Date | Timestamp;
  maxPlayers: number;
  currentTrackUri?: string;
  isPlaying?: boolean;
  progressMs?: number;
  currentTrack?: {
    uri: string;
    name: string;
    artists: Array<{ name: string; id: string }>;
    duration_ms: number;
    album: {
      name: string;
      images: Array<{ url: string; height: number; width: number }>;
    };
  };
  updatedAt?: Date | Timestamp;
  guessWindowMs?: number; // default 30000
  disableGuessing?: boolean;
  
  playerScores?: {
    [playerId: string]: number;
  };
  
  correctlyGuessedTracks?: {
    [trackUri: string]: boolean;
  };
  
  players: {
    [playerId: string]: Player;
  };
}

export interface PlaylistCollection {
  lobbyId: string;
  createdAt: Date | Timestamp;
  playlistId: string;
  songs: {
    [trackUri: string]: {
      addedBy: string;
      trackInfo: Track;
      addedAt: Date | Timestamp;
    };
  };
  stats: {
    totalSongs: number;
    playersWithSongs: number;
  };
}

export interface TrackProposal {
  trackUri: string;
  proposedBy: string;
  trackInfo: Track;
  status: 'pending' | 'approved' | 'rejected';
  proposedAt: Date | Timestamp;
  reason?: string; // For rejection reason
}


// NEW - Guess interface as per game.md specification
export interface Guess {
  id: string;          // auto-id
  playerId: string;    // who guessed
  trackUri: string;    // which track
  guessedOwnerId: string;
  isCorrect: boolean;
  createdAt: Timestamp;
}

// NEW - PlayerScore interface as per game.md specification
export interface PlayerScore {
  playerId: string;
  score: number;
}

// Legacy interface for backward compatibility
export interface Song {
  id: string;
  name: string;
  artist: string;
  addedBy: string;
  uri: string;
}

// Legacy interface for backward compatibility - renamed to avoid conflicts
export interface LegacyGameState {
  id: string;
  host: Player;
  players: Player[];
  playlist: Song[];
  currentSong: Song | null;
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  maxRounds: number;
} 

export interface GameResult {
  lobbyId: string;
  hostId: string;
  endedAt: Date | Timestamp;
  durationSec?: number | null;
  finalScores: {
    [playerId: string]: number;
  };
  players: {
    [playerId: string]: Player;
  };
  // List of winner player IDs (handles ties)
  winnerIds: string[];
  playlistId?: string | null;
  autoEnded?: boolean;
} 