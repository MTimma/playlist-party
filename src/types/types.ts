import { Timestamp } from 'firebase/firestore';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: Date | Timestamp;
  score: number;
  avatarUrl?: string;
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

export interface Lobby {
  id: string;
  hostFirebaseUid: string;
  hostSpotifyUserId: string;
  playlistId?: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished';
  createdAt: Date | Timestamp;
  maxPlayers: number;
  currentRound?: number;
  players: {
    [playerId: string]: Player;
  };
}

export interface PlaylistCollection {
  lobbyId: string;
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

// Legacy interface for backward compatibility
export interface Song {
  id: string;
  name: string;
  artist: string;
  addedBy: string;
  uri: string;
}

// Legacy interface for backward compatibility
export interface GameState {
  id: string;
  host: Player;
  players: Player[];
  playlist: Song[];
  currentSong: Song | null;
  status: 'waiting' | 'playing' | 'finished';
  round: number;
  maxRounds: number;
} 