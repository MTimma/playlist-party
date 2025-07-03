// Game configuration constants
export const GAME_CONSTANTS = {
  // Default guess window in milliseconds (30 seconds)
  DEFAULT_GUESS_WINDOW_MS: 30000,
  
  // Points for correct guesses
  FIRST_CORRECT_GUESS_POINTS: 3,
  LATER_CORRECT_GUESS_POINTS: 1,
  
  // Points deducted for wrong guesses
  WRONG_GUESS_PENALTY: -1,
  
  // Spotify playback polling interval (3 seconds)
  PLAYBACK_POLL_INTERVAL_MS: 3000,
  
  // Progress bar update interval (1 second)
  PROGRESS_UPDATE_INTERVAL_MS: 1000,
  
  // Real-time sync target (under 1 second)
  SYNC_TARGET_MS: 1000,
} as const; 