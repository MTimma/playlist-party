import SpotifyWebApi from 'spotify-web-api-node';
import type { Song } from '../types/types';

const spotifyApi = new SpotifyWebApi({
  clientId: import.meta.env.VITE_SPOTIFY_CLIENT_ID,
  clientSecret: import.meta.env.VITE_SPOTIFY_CLIENT_SECRET,
  redirectUri: import.meta.env.VITE_SPOTIFY_REDIRECT_URI
});

export const setAccessToken = (token: string) => {
  spotifyApi.setAccessToken(token);
};

export const searchSongs = async (query: string): Promise<Song[]> => {
  try {
    const response = await spotifyApi.searchTracks(query, { limit: 5 });
    return response.body.tracks?.items.map(track => ({
      id: track.id,
      name: track.name,
      artist: track.artists[0].name,
      addedBy: '',
      uri: track.uri
    })) || [];
  } catch (error) {
    console.error('Error searching songs:', error);
    return [];
  }
};

export const playSong = async (uri: string) => {
  try {
    await spotifyApi.play({ uris: [uri] });
  } catch (error) {
    console.error('Error playing song:', error);
  }
};

export const pauseSong = async () => {
  try {
    await spotifyApi.pause();
  } catch (error) {
    console.error('Error pausing song:', error);
  }
};

export const getCurrentPlaybackState = async () => {
  try {
    const response = await spotifyApi.getMyCurrentPlaybackState();
    return response.body;
  } catch (error) {
    console.error('Error getting playback state:', error);
    return null;
  }
}; 