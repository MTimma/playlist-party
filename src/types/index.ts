export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  score: number;
}

export interface Song {
  id: string;
  name: string;
  artist: string;
  addedBy: string;
  uri: string;
}

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