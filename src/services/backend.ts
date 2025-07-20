import type { SpotifyPlaybackResponse } from '../types/types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

if (!BACKEND_URL) {
  throw new Error('VITE_BACKEND_URL environment variable is required');
}

// Get currently playing track from Spotify via backend
export const getCurrentlyPlaying = async (lobbyId: string): Promise<SpotifyPlaybackResponse | null> => {
  const response = await fetch(`${BACKEND_URL}/api/spotify/currently-playing/${lobbyId}`, {
    credentials: 'include'
  });

  if (!response.ok) {
    if (response.status === 401) {
      return null; // Host not authenticated
    }
    if (response.status === 404) {
      return null; // Lobby not found
    }
    if (response.status === 204) {
      // No content - no active playback
      return { is_playing: false, item: null };
    }
    const error = await response.json();
    throw new Error(error.error || 'Failed to get currently playing track');
  }

  return response.json();
};

// Validate a guess for a track
export const validateGuess = async (
  lobbyId: string,
  playerId: string,
  trackUri: string,
  guessedOwnerId: string
): Promise<{ isCorrect: boolean; correctOwnerId?: string; scoreChange: number }> => {
  const response = await fetch(`${BACKEND_URL}/api/game/validate-guess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      lobbyId,
      playerId,
      trackUri,
      guessedOwnerId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to validate guess');
  }

  return response.json();
};

// Check if a player has already guessed for a specific track
export const checkPlayerGuess = async (
  lobbyId: string,
  playerId: string,
  trackUri: string
): Promise<{ hasGuessed: boolean; guess?: { id: string; playerId: string; trackUri: string; guessedOwnerId: string; isCorrect: boolean; createdAt: Date } }> => {
  const response = await fetch(
    `${BACKEND_URL}/api/game/${lobbyId}/guess/${encodeURIComponent(trackUri)}?playerId=${playerId}`,
    {
      method: 'GET',
      credentials: 'include'
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to check player guess');
  }

  return response.json();
};

// Store host's Spotify access token
export const storeHostToken = async (
  lobbyId: string,
  accessToken: string,
  spotifyUserId: string
): Promise<void> => {
  const response = await fetch(`${BACKEND_URL}/api/game/${lobbyId}/host-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    body: JSON.stringify({
      accessToken,
      spotifyUserId
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to store host token');
  }
}; 