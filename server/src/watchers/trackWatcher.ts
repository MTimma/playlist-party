import axios from 'axios';
import * as admin from 'firebase-admin';

interface WatcherState {
  timer: NodeJS.Timeout;
  pauseUntil: number;
  accessToken: string;
  refreshToken: string;
  hostSpotifyUserId: string;
  lobbyId: string;
}

interface WatcherConfig {
  pollMs: number;
  maxConcurrency: number;
  defaultBackoffMs: number;
}

class TrackWatcherManager {
  private watchers = new Map<string, WatcherState>();
  private config: WatcherConfig;
  private db: admin.firestore.Firestore;

  constructor(db: admin.firestore.Firestore, config?: Partial<WatcherConfig>) {
    this.db = db;
    this.config = {
      pollMs: config?.pollMs || parseInt(process.env.WATCHER_POLL_MS || '1000'),
      maxConcurrency: config?.maxConcurrency || parseInt(process.env.WATCHER_MAX_CONCURRENCY || '500'),
      defaultBackoffMs: config?.defaultBackoffMs || parseInt(process.env.WATCHER_DEFAULT_BACKOFF_MS || '15000')
    };
  }

  async startWatcher(
    lobbyId: string, 
    hostAccessToken: string, 
    hostRefreshToken: string,
    hostSpotifyUserId: string
  ): Promise<void> {
    // Check if watcher already exists for this lobby
    if (this.watchers.has(lobbyId)) {
      console.log(`Watcher already exists for lobby: ${lobbyId}`);
      return;
    }

    // Check concurrency limit
    if (this.watchers.size >= this.config.maxConcurrency) {
      console.error(`Max concurrency reached (${this.config.maxConcurrency}), refusing to start watcher for lobby: ${lobbyId}`);
      throw new Error('Maximum concurrent watchers exceeded');
    }

    // Guard against token reuse across lobbies
    for (const [existingLobbyId, state] of this.watchers.entries()) {
      if (state.hostSpotifyUserId === hostSpotifyUserId && existingLobbyId !== lobbyId) {
        console.error(`SECURITY WARNING: Attempted to reuse host token ${hostSpotifyUserId} for lobby ${lobbyId}, already in use by lobby ${existingLobbyId}`);
        throw new Error('Host token already in use by another lobby');
      }
    }

    console.log(`Starting watcher for lobby: ${lobbyId}, host: ${hostSpotifyUserId}`);

    // Create watcher state
    const watcherState: WatcherState = {
      timer: null as any, // Will be set below
      pauseUntil: 0,
      accessToken: hostAccessToken,
      refreshToken: hostRefreshToken,
      hostSpotifyUserId,
      lobbyId
    };

    // Start the polling loop
    const timer = setInterval(() => {
      this.pollSpotifyPlayback(lobbyId).catch(error => {
        console.error(`Error in watcher loop for lobby ${lobbyId}:`, error);
      });
    }, this.config.pollMs);

    watcherState.timer = timer;
    this.watchers.set(lobbyId, watcherState);

    // Store tokens in Firestore for crash recovery
    await this.db.collection('lobbies').doc(lobbyId).update({
      hostAccessToken,
      hostRefreshToken,
      hostSpotifyUserId
    });

    console.log(`Watcher started for lobby: ${lobbyId}`);
  }

  stopWatcher(lobbyId: string): void {
    const watcherState = this.watchers.get(lobbyId);
    if (!watcherState) {
      console.log(`No watcher found for lobby: ${lobbyId}`);
      return;
    }

    console.log(`Stopping watcher for lobby: ${lobbyId}`);
    clearInterval(watcherState.timer);
    this.watchers.delete(lobbyId);
    console.log(`Watcher stopped for lobby: ${lobbyId}`);
  }

  private async pollSpotifyPlayback(lobbyId: string): Promise<void> {
    const watcherState = this.watchers.get(lobbyId);
    if (!watcherState) {
      console.log(`Watcher state not found for lobby: ${lobbyId}`);
      return;
    }

    // Check if we're in a backoff period
    if (Date.now() < watcherState.pauseUntil) {
      return;
    }

    try {
      console.log(`Polling Spotify for lobby ${lobbyId}...`);
      const response = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
        headers: {
          'Authorization': `Bearer ${watcherState.accessToken}`,
          'Accept': 'application/json'
        },
        timeout: 5000
      });

      // Success - update Firestore with current playback state
      const playbackData = response.data;
      const updateData: any = {
        isPlaying: playbackData?.is_playing || false,
        trackUri: playbackData?.item?.uri || null,
        progressMs: playbackData?.progress_ms || 0,
        currentTrack: playbackData?.item || null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      console.log(`Updating Firestore for lobby ${lobbyId}:`, {
        isPlaying: updateData.isPlaying,
        trackUri: updateData.trackUri,
        hasTrackData: !!updateData.currentTrack
      });

      await this.db.collection('lobbies').doc(lobbyId).update(updateData);

    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          // Token expired - refresh it
          console.log(`Access token expired for lobby ${lobbyId}, refreshing...`);
          await this.refreshAccessToken(lobbyId);
        } else if (error.response?.status === 429) {
          // Rate limited - respect Retry-After header
          const retryAfter = error.response.headers['retry-after'];
          const backoffMs = retryAfter ? (parseInt(retryAfter) * 1000) : this.config.defaultBackoffMs;
          watcherState.pauseUntil = Date.now() + backoffMs + 200; // Add 200ms buffer
          console.log(`Rate limited for lobby ${lobbyId}, backing off for ${backoffMs}ms`);
        } else if (error.response?.status === 204) {
          // No content - player is not active, but this is not an error
          console.log(`No active playback for lobby ${lobbyId} (204 response)`);
          const updateData = {
            isPlaying: false,
            trackUri: null,
            progressMs: 0,
            currentTrack: null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          await this.db.collection('lobbies').doc(lobbyId).update(updateData);
        } else {
          console.error(`HTTP error ${error.response?.status} for lobby ${lobbyId}:`, error.response?.data);
        }
      } else {
        console.error(`Network/timeout error for lobby ${lobbyId}:`, error.message);
      }
    }
  }

  private async refreshAccessToken(lobbyId: string): Promise<void> {
    const watcherState = this.watchers.get(lobbyId);
    if (!watcherState) {
      console.error(`Cannot refresh token: watcher state not found for lobby ${lobbyId}`);
      return;
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: watcherState.refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID!,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET!
      });

      const response = await axios.post(
        'https://accounts.spotify.com/api/token',
        params,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 5000
        }
      );

      const { access_token, refresh_token } = response.data;
      
      // Update in-memory state
      watcherState.accessToken = access_token;
      if (refresh_token) {
        watcherState.refreshToken = refresh_token;
      }

      // Update Firestore
      const updateData: any = {
        hostAccessToken: access_token
      };
      if (refresh_token) {
        updateData.hostRefreshToken = refresh_token;
      }

      await this.db.collection('lobbies').doc(lobbyId).update(updateData);

      console.log(`Access token refreshed for lobby ${lobbyId}`);

    } catch (error) {
      console.error(`Failed to refresh access token for lobby ${lobbyId}:`, error);
      // Could implement exponential backoff here
    }
  }

  // Get current watcher count for monitoring
  getWatcherCount(): number {
    return this.watchers.size;
  }

  // Get watcher info for a specific lobby
  getWatcherInfo(lobbyId: string): { exists: boolean; hostSpotifyUserId?: string } {
    const watcher = this.watchers.get(lobbyId);
    return {
      exists: !!watcher,
      hostSpotifyUserId: watcher?.hostSpotifyUserId
    };
  }

  // Cleanup all watchers (for graceful shutdown)
  stopAllWatchers(): void {
    console.log(`Stopping all ${this.watchers.size} watchers...`);
    for (const [lobbyId] of this.watchers.entries()) {
      this.stopWatcher(lobbyId);
    }
  }
}

export default TrackWatcherManager; 