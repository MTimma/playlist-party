import axios from 'axios';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
  private isRateLimited = false;
  private rateLimitClearsAt = 0;
  private logDir: string;

  constructor(db: admin.firestore.Firestore, config?: Partial<WatcherConfig>) {
    this.db = db;
    this.config = {
      pollMs: config?.pollMs || parseInt(process.env.WATCHER_POLL_MS || '1000'),
      maxConcurrency: config?.maxConcurrency || parseInt(process.env.WATCHER_MAX_CONCURRENCY || '500'),
      defaultBackoffMs: config?.defaultBackoffMs || parseInt(process.env.WATCHER_DEFAULT_BACKOFF_MS || '15000')
    };
    
    // Setup log directory for rate limit logging
    this.logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
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

    // Check if system is currently rate limited
    if (this.isRateLimited && Date.now() < this.rateLimitClearsAt) {
      const waitSeconds = Math.ceil((this.rateLimitClearsAt - Date.now()) / 1000);
      console.error(`System is rate-limited, refusing to start watcher for lobby: ${lobbyId}. Clears in ${waitSeconds}s`);
      const error: any = new Error(`Server is temporarily rate-limited by Spotify. Please wait ${waitSeconds} seconds and try again.`);
      error.code = 'RATE_LIMITED';
      error.currentParties = this.watchers.size;
      error.retryAfterSeconds = waitSeconds;
      throw error;
    }

    // Check concurrency limit
    if (this.watchers.size >= this.config.maxConcurrency) {
      console.error(`Max concurrency reached (${this.config.maxConcurrency}), refusing to start watcher for lobby: ${lobbyId}`);
      const error: any = new Error('Maximum concurrent parties exceeded');
      error.code = 'PARTY_LIMIT_REACHED';
      error.currentParties = this.watchers.size;
      error.maxParties = this.config.maxConcurrency;
      throw error;
    }

    // Guard against token reuse across lobbies
    
    if (!process.env.ALLOW_TOKEN_REUSE) {
      // 1. Retire any existing watcher belonging to the same Spotify user
      for (const [existingLobbyId, state] of this.watchers.entries()) {
        if (state.hostSpotifyUserId === hostSpotifyUserId && existingLobbyId !== lobbyId) {
          console.warn(
            `Host ${hostSpotifyUserId} already controls lobby ${existingLobbyId}. ` +
            `Stopping old watcher and transferring control to lobby ${lobbyId}.`
          );
          this.stopWatcher(existingLobbyId);
          // mark the old lobby ended so clients know
          await this.db.collection('lobbies')
                      .doc(existingLobbyId)
                      .update({ status: 'terminated_by_host' });
        }
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

      console.log(`${new Date().toISOString()} Polling Spotify for lobby ${lobbyId}...`);
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

      // Clear network issue flag on successful update
      updateData.networkIssue = false;
      updateData.networkIssueMessage = null;

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
          
          // Set global rate limit flag to block new parties
          this.isRateLimited = true;
          this.rateLimitClearsAt = Date.now() + backoffMs + 1000; // Add 1s buffer
          
          console.warn(`⚠️  RATE LIMITED for lobby ${lobbyId}, backing off for ${backoffMs}ms`);
          console.warn(`⚠️  Blocking new parties until ${new Date(this.rateLimitClearsAt).toISOString()}`);
          
          // Log concurrent watcher count to file for analysis
          this.logRateLimitEvent(lobbyId, backoffMs);
          
          // Update lobby with network issue warning
          await this.db.collection('lobbies').doc(lobbyId).update({
            networkIssue: true,
            networkIssueMessage: 'Experiencing network issues. Playback tracking may be delayed.',
            networkIssueAt: admin.firestore.FieldValue.serverTimestamp()
          }).catch(err => {
            console.error(`Failed to update lobby with network issue flag:`, err);
          });
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
        console.error(`Network/timeout error for lobby ${lobbyId}:`, error);
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

  // Get rate limit status
  getRateLimitStatus(): { isRateLimited: boolean; clearsAt: number; clearsInSeconds: number } {
    const now = Date.now();
    const clearsInSeconds = this.isRateLimited && this.rateLimitClearsAt > now 
      ? Math.ceil((this.rateLimitClearsAt - now) / 1000)
      : 0;
    
    return {
      isRateLimited: this.isRateLimited && this.rateLimitClearsAt > now,
      clearsAt: this.rateLimitClearsAt,
      clearsInSeconds
    };
  }

  // Log rate limit event to file for analysis
  private logRateLimitEvent(lobbyId: string, backoffMs: number): void {
    try {
      const timestamp = new Date().toISOString();
      const logEntry = {
        timestamp,
        lobbyId,
        concurrentWatchers: this.watchers.size,
        backoffMs,
        activeLobbies: Array.from(this.watchers.keys())
      };
      
      const logLine = JSON.stringify(logEntry) + '\n';
      const logFile = path.join(this.logDir, 'rate-limits.log');
      
      fs.appendFileSync(logFile, logLine, 'utf8');
      
      console.log(`📝 Logged rate limit event to ${logFile}`);
      console.log(`📊 Concurrent watchers at time of 429: ${this.watchers.size}`);
      console.log(`📊 Active lobbies: ${logEntry.activeLobbies.join(', ')}`);
    } catch (error) {
      console.error('Failed to log rate limit event:', error);
    }
  }
}

export default TrackWatcherManager; 