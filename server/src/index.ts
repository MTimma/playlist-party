import express, { RequestHandler } from 'express';
import axios from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import * as admin from 'firebase-admin';
import TrackWatcherManager from './watchers/trackWatcher';

dotenv.config();

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
    databaseURL: process.env.FIREBASE_DATABASE_URL,
  });
}

const db = admin.firestore();

// Initialize Track Watcher Manager
const trackWatcherManager = new TrackWatcherManager(db);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, stopping all watchers...');
  trackWatcherManager.stopAllWatchers();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, stopping all watchers...');
  trackWatcherManager.stopAllWatchers();
  process.exit(0);
});

// Monitor lobby status changes and stop watchers when parties end
const setupLobbyStatusMonitoring = () => {
  const lobbiesRef = db.collection('lobbies');
  
  // Listen for lobby status changes
  lobbiesRef.onSnapshot((snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'modified') {
        const lobbyData = change.doc.data();
        const lobbyId = change.doc.id;
        
        // Stop watcher if lobby is finished or deleted
        if (lobbyData.status === 'finished' || lobbyData.status === 'deleted') {
          console.log(`Lobby ${lobbyId} status changed to ${lobbyData.status}, stopping watcher`);
          trackWatcherManager.stopWatcher(lobbyId);
        }
      }
      
      if (change.type === 'removed') {
        const lobbyId = change.doc.id;
        console.log(`Lobby ${lobbyId} was deleted, stopping watcher`);
        trackWatcherManager.stopWatcher(lobbyId);
      }
    });
  }, (error) => {
    console.error('Error monitoring lobby status changes:', error);
  });
};

// Start monitoring after a short delay to ensure Firebase is ready
setTimeout(setupLobbyStatusMonitoring, 1000);

// Validate required environment variables
const requiredEnvVars = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI',
  'FRONTEND_URL'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
}

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for static files
}));
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight request for 10 minutes
}));
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(cookieParser());

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Search-specific rate limiting
const searchLimiter = rateLimit({
  windowMs: 1000, // 1 second
  max: 3, // 3 requests per second per IP
  message: { error: 'Too many search requests, please try again later' }
});

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID!;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET!;
const REDIRECT_URI_ENV = process.env.SPOTIFY_REDIRECT_URI || null;
const FRONTEND_URL = process.env.FRONTEND_URL!;
const SPOTIFY_ACCOUNTS_URL = process.env.SPOTIFY_ACCOUNTS_URL || 'https://accounts.spotify.com';

// Cache for client credentials token
interface ClientCredentialsCache {
  token: string;
  expiresAt: number;
}

// Spotify API response types
interface SpotifyTrack {
  uri: string;
  name: string;
  artists: Array<{
    name: string;
    id: string;
  }>;
  duration_ms: number;
  preview_url: string | null;
  album: {
    name: string;
    images: Array<{
      url: string;
      height: number;
      width: number;
    }>;
  };
}

let clientCredentialsCache: ClientCredentialsCache | null = null;

// Get client credentials token (cached)
const getClientCredentialsToken = async (): Promise<string> => {
  const now = Date.now();
  
  // Return cached token if valid
  if (clientCredentialsCache && clientCredentialsCache.expiresAt > now + 60000) { // 1 minute buffer
    return clientCredentialsCache.token;
  }
  
  try {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    });

    const response = await axios.post(
      `${SPOTIFY_ACCOUNTS_URL}/api/token`,
      params,
      { 
        headers: { 
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        timeout: 5000
      }
    );

    const { access_token, expires_in } = response.data;
    
    // Cache the token
    clientCredentialsCache = {
      token: access_token,
      expiresAt: now + (expires_in * 1000) // Convert to milliseconds
    };
    
    return access_token;
  } catch (error) {
    console.error('Error getting client credentials token:', error);
    throw new Error('Failed to authenticate with Spotify');
  }
};

// Helper to determine which redirect URI to use (env var overrides dynamic)
const getRedirectUri = (req: express.Request): string => {
  return REDIRECT_URI_ENV || `${req.protocol}://${req.get('host')}/callback`;
};

// 1. Redirect user to Spotify login
app.get('/login', (req, res) => {
  const scope = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
    'playlist-modify-private',
    'playlist-modify-public'
  ].join(' ');
  const redirectUri = getRedirectUri(req);
  const authUrl = `${SPOTIFY_ACCOUNTS_URL}/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(authUrl);
});

// 2. Handle Spotify callback and exchange code for tokens
app.get('/callback', (req, res) => {
  (async () => {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send('Missing code');

    try {
      const redirectUri = getRedirectUri(req);
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      });

      const tokenRes = await axios.post(
        `${SPOTIFY_ACCOUNTS_URL}/api/token`,
        params,
        { 
          headers: { 
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          timeout: 5000 // 5 second timeout
        }
      );

      // Set tokens in httpOnly cookies with enhanced security
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        domain: new URL(FRONTEND_URL).hostname,
        path: '/',
        maxAge: tokenRes.data.expires_in * 1000
      };

      console.log('=== Setting Cookies ===');
      console.log('Cookie options:', cookieOptions);
      console.log('Access token length:', tokenRes.data.access_token?.length || 0);
      
      res.cookie('spotify_access_token', tokenRes.data.access_token, cookieOptions);
      res.cookie('spotify_refresh_token', tokenRes.data.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for refresh token
      });

      console.log('Cookies set, redirecting to:', `${FRONTEND_URL}/callback`);
      
      // Redirect to frontend
      res.redirect(`${FRONTEND_URL}/callback`);
    } catch (err: unknown) {
      console.error('Token exchange error:', err);
      if (axios.isAxiosError(err)) {
        res.status(500).json({ error: 'Failed to get tokens', details: err.response?.data || err.message });
      } else if (err instanceof Error) {
        res.status(500).json({ error: 'Failed to get tokens', details: err.message });
      } else {
        res.status(500).json({ error: 'Failed to get tokens', details: 'Unknown error' });
      }
    }
  })();
});

// 3. Get current access token
app.get('/auth/token', ((req, res) => {
  try {
    const accessToken = req.cookies.spotify_access_token;
    if (!accessToken) {
      return res.status(401).json({ error: 'No access token' });
    }
    res.json({ accessToken });
  } catch {
    res.status(500).json({ error: 'Failed to get token' });
  }
}) as RequestHandler);

// 4. Check authentication status
app.get('/auth/status', (req, res) => {
  const accessToken = req.cookies.spotify_access_token;
  res.json({ isAuthenticated: !!accessToken });
});

// 5. Logout
app.post('/auth/logout', (_req, res) => {
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    domain: new URL(FRONTEND_URL).hostname,
    path: '/'
  };

  res.clearCookie('spotify_access_token', cookieOptions);
  res.clearCookie('spotify_refresh_token', cookieOptions);
  res.json({ success: true });
});

app.get('/me', (async (req, res) => {
  const accessToken = req.cookies.spotify_access_token;
  if (!accessToken) {
    return res.status(401).json({ error: 'No access token' });
  }
  try {
    const userRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = userRes.data;
    if (profile.product !== 'premium') {
      return res.status(403).json({ error: 'Premium account required' });
    }
    res.json(profile);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}) as RequestHandler);

// 7. Store host's Spotify access token
app.post('/api/party/:lobbyId/host-token', (async (req, res) => {
  console.log('=== Store Host Token Request ===');
  console.log('Lobby ID:', req.params.lobbyId);
  console.log('Request body:', req.body);
  
  try {
    const { lobbyId } = req.params;
    const { accessToken, spotifyUserId } = req.body;
    
    if (!accessToken || !spotifyUserId) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Storing host access token for lobby:', lobbyId);
    await db.collection('lobbies').doc(lobbyId).update({
      hostAccessToken: accessToken,
      hostSpotifyUserId: spotifyUserId
    });

    console.log('Host token stored successfully');
    res.json({ success: true, message: 'Host token stored' });
    
  } catch (error) {
    console.error('Store host token error:', error);
    res.status(500).json({ error: 'Failed to store host token' });
  }
}) as RequestHandler);

// 8. Create playlist endpoint - ENHANCED with watcher integration
app.post('/api/spotify/playlist', (async (req, res) => {
  try {
    console.log('=== Playlist Creation Request ===');
    console.log('Cookies received:', req.cookies);
    console.log('Headers:', req.headers);
    
    const accessToken = req.cookies.spotify_access_token;
    const refreshToken = req.cookies.spotify_refresh_token;
    console.log('Access token found:', !!accessToken);
    console.log('Refresh token found:', !!refreshToken);
    
    if (!accessToken) {
      console.log('No access token in cookies');
      return res.status(401).json({ error: 'No access token' });
    }

    if (!refreshToken) {
      console.log('No refresh token in cookies');
      return res.status(401).json({ error: 'No refresh token' });
    }

    const { name, description = 'Generated by Playlist Party', trackUris = [], lobbyId } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Playlist name is required' });
    }

    if (name.length < 1 || name.length > 100) {
      return res.status(400).json({ error: 'Playlist name must be 1-100 characters' });
    }

    // Get user profile to get user ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 5000
    });

    const userId = userResponse.data.id;

    // Create playlist
    console.log('Create playlist');
    const playlistResponse = await axios.post(
      `https://api.spotify.com/v1/users/${userId}/playlists`,
      {
        name: name.trim(),
        description,
        public: false,
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000
      }
    );

    const playlist = {
      id: playlistResponse.data.id,
      name: playlistResponse.data.name,
      snapshot_id: playlistResponse.data.snapshot_id,
      external_urls: playlistResponse.data.external_urls
    };

    console.log('Playlist created');

    // Add tracks if provided
    if (trackUris.length > 0) {
      // Spotify API allows max 100 tracks per request
      const batchSize = 100;
      let latestSnapshotId = playlist.snapshot_id;

      for (let i = 0; i < trackUris.length; i += batchSize) {
        const batch = trackUris.slice(i, i + batchSize);
        console.log('Add tracks');
        const addTracksResponse = await axios.post(
          `https://api.spotify.com/v1/playlists/${playlist.id}/tracks`,
          {
            uris: batch,
          },
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            timeout: 10000
          }
        );

        latestSnapshotId = addTracksResponse.data.snapshot_id;
      }

      playlist.snapshot_id = latestSnapshotId;
    }

    // Store host's access token and refresh token for playback monitoring
    if (lobbyId) {
      console.log('Storing host tokens and starting watcher for lobby:', lobbyId);
      
      try {
        // Start the watcher for this lobby
        await trackWatcherManager.startWatcher(
          lobbyId,
          accessToken,
          refreshToken,
          userId
        );
        
        console.log('Watcher started successfully for lobby:', lobbyId);
      } catch (watcherError) {
        console.error('Failed to start watcher for lobby:', lobbyId, watcherError);
        // Don't fail the playlist creation, but log the error
      }
    }

    res.json({
      success: true,
      playlist,
      tracksAdded: trackUris.length
    });
    console.log('Playlist created successfully');
    
  } catch (error) {
    console.error('Playlist creation error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        res.status(401).json({ error: 'Spotify authentication expired' });
      } else if (error.response?.status === 403) {
        res.status(403).json({ error: 'Insufficient Spotify permissions' });
      } else if (error.response?.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded, please try again later' });
      } else {
        res.status(500).json({ error: 'Failed to create playlist', details: error.response?.data });
      }
    } else {
      res.status(500).json({ error: 'Failed to create playlist' });
    }
  }
}) as RequestHandler);

// 8. Search tracks endpoint (using client credentials)
app.get('/api/spotify/search', searchLimiter, (async (req, res) => {
  try {
    const { q, type = 'track', limit = '10' } = req.query;
    
    if (!q || typeof q !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required' });
    }
    
    if (q.trim().length === 0) {
      return res.json({ tracks: [] });
    }
    
    const clientToken = await getClientCredentialsToken();
    
    const searchResponse = await axios.get('https://api.spotify.com/v1/search', {
      headers: {
        'Authorization': `Bearer ${clientToken}`,
        'Accept': 'application/json'
      },
      params: {
        q: q.trim(),
        type,
        limit: Math.min(parseInt(limit as string) || 10, 50), // Max 50 results
        market: 'US' // Optional: restrict to specific market
      },
      timeout: 5000
    });
    
    // Transform the response to match our Track interface
    const tracks = searchResponse.data.tracks?.items?.map((track: SpotifyTrack) => ({
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist) => ({
        name: artist.name,
        id: artist.id
      })),
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      album: {
        name: track.album.name,
        images: track.album.images.map((img) => ({
          url: img.url,
          height: img.height,
          width: img.width
        }))
      }
    })) || [];
    
    res.json({ tracks });
    
  } catch (error) {
    console.error('Search error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded, please try again later' });
      } else if (error.response?.status === 401) {
        // Clear cache and retry once
        clientCredentialsCache = null;
        res.status(500).json({ error: 'Authentication failed, please try again' });
      } else {
        res.status(500).json({ error: 'Search failed, please try again' });
      }
    } else {
      res.status(500).json({ error: 'Search failed, please try again' });
    }
  }
}) as RequestHandler);

// Rate limiting store for guess submissions
const guessRateLimit = new Map<string, number>();

// 10. Get track owner for validation (server only) - WITH TRANSACTION PROTECTION
app.post('/api/party/validate-guess', (async (req, res) => {
  console.log('=== Guess Validation Request ===');
  console.log('Request body:', req.body);
  
  try {
    const { lobbyId, trackUri, guessedOwnerId, playerId } = req.body;
    
    if (!lobbyId || !trackUri || !guessedOwnerId || !playerId) {
      console.log('Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // SERVER-SIDE RATE LIMITING: Implement per-player guess cooldown (2 seconds)
    const playerRateKey = `${playerId}:${lobbyId}`;
    const now = Date.now();
    const lastGuessTime = guessRateLimit.get(playerRateKey) || 0;
    
    if (now - lastGuessTime < 2000) {
      console.log('Rate limited: Player guessing too frequently');
      return res.status(429).json({ error: 'Please wait before guessing again' });
    }
    
    guessRateLimit.set(playerRateKey, now);

    // Use Firestore transaction to prevent race conditions
    const result = await db.runTransaction(async (transaction) => {
      console.log('Starting transaction for guess validation');
      
      // Get lobby data first to check solved tracks and find player names
      const lobbyRef = db.collection('lobbies').doc(lobbyId);
      const lobbyDoc = await transaction.get(lobbyRef);
      
      if (!lobbyDoc.exists) {
        console.log('Lobby not found:', lobbyId);
        throw new Error('Lobby not found');
      }

      const lobbyData = lobbyDoc.data();
      const correctlyGuessedTracks = lobbyData?.correctlyGuessedTracks || {};
      
      // Check if track is already solved (first correct guess wins logic)
      if (correctlyGuessedTracks[trackUri] === true) {
        console.log('Track already correctly guessed');
        throw new Error('Track already correctly guessed');
      }
      
      // Check if player already guessed for this track (within transaction)
      const guessesRef = db.collection('lobbies').doc(lobbyId).collection('guesses');
      const existingGuessQuery = guessesRef
        .where('playerId', '==', playerId)
        .where('trackUri', '==', trackUri);
      
      const existingGuesses = await transaction.get(existingGuessQuery);
      
      if (!existingGuesses.empty) {
        console.log('Player already guessed for this track');
        throw new Error('Already guessed for this track');
      }

      // Get playlist data to validate track owner
      const playlistRef = db.collection('playlists').doc(lobbyId);
      const playlistDoc = await transaction.get(playlistRef);
      
      if (!playlistDoc.exists) {
        console.log('Playlist not found for lobby:', lobbyId);
        throw new Error('Playlist not found');
      }

      const playlistData = playlistDoc.data();
      const songData = playlistData?.songs?.[trackUri];
      
      if (!songData) {
        console.log('Track not found in playlist:', trackUri);
        throw new Error('Track not found in playlist');
      }

      const realOwnerId = songData.addedBy;
      const isCorrect = realOwnerId === guessedOwnerId;
      const players = lobbyData?.players || {};
      const realOwnerName = players[realOwnerId]?.name || 'Unknown';
      
      // ATOMIC OPERATIONS: Record guess and update score in same transaction
      const guessRef = guessesRef.doc();
      const guessData = {
        playerId,
        trackUri,
        guessedOwnerId,
        isCorrect,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      transaction.set(guessRef, guessData);
      
      // Calculate score change: +1 for correct, -1 for incorrect
      const scoreChange = isCorrect ? 1 : -1;
      
      // Get current player score to ensure it doesn't go below 0
      const currentPlayerScores = lobbyData?.playerScores || {};
      const currentScore = currentPlayerScores[playerId] || 0;
      const newScore = Math.max(0, currentScore + scoreChange);
      
      // Update score atomically
      transaction.update(lobbyRef, {
        [`playerScores.${playerId}`]: newScore
      });
      
      // If guess is correct, mark track as solved
      if (isCorrect) {
        transaction.update(lobbyRef, {
          [`correctlyGuessedTracks.${trackUri}`]: true
        });
      }
      
      console.log('Transaction completed successfully');
      return {
        isCorrect,
        correctOwnerId: realOwnerId,
        correctOwnerName: realOwnerName,
        scoreChange
      };
    });

    console.log('Guess validation completed successfully');
    res.json(result);
    
  } catch (error) {
    console.error('Guess validation error:', error);
    
    // Clean up rate limit on error
    const playerRateKey = `${req.body.playerId}:${req.body.lobbyId}`;
    guessRateLimit.delete(playerRateKey);
    
    const errorMessage = error instanceof Error ? error.message : 'Failed to validate guess';
    res.status(500).json({ error: errorMessage });
  }
}) as RequestHandler);

// Check if a player has already guessed for a specific track
app.get('/api/party/:lobbyId/guess/:trackUri', (async (req, res) => {
  try {
    const { lobbyId, trackUri } = req.params;
    const { playerId } = req.query;
    
    if (!playerId || typeof playerId !== 'string') {
      return res.status(400).json({ error: 'playerId query parameter is required' });
    }

    const decodedTrackUri = decodeURIComponent(trackUri);
    
    console.log('Checking guess status:', { lobbyId, trackUri: decodedTrackUri, playerId });
    
    // Query for existing guess
    const existingGuessQuery = await db.collection('lobbies').doc(lobbyId)
      .collection('guesses')
      .where('playerId', '==', playerId)
      .where('trackUri', '==', decodedTrackUri)
      .get();

    if (existingGuessQuery.empty) {
      res.json({ hasGuessed: false });
    } else {
      const guessDoc = existingGuessQuery.docs[0];
      const guessData = guessDoc.data();
      
      res.json({ 
        hasGuessed: true,
        guess: {
          id: guessDoc.id,
          playerId: guessData.playerId,
          trackUri: guessData.trackUri,
          guessedOwnerId: guessData.guessedOwnerId,
          createdAt: guessData.createdAt?.toDate() || new Date()
        }
      });
    }
    
  } catch (error) {
    console.error('Error checking guess status:', error);
    res.status(500).json({ error: 'Failed to check guess status' });
  }
}) as RequestHandler);

// 11. End game and archive results
app.post('/api/party/:lobbyId/end', (async (req, res) => {
  try {
    const { lobbyId } = req.params;
    const { autoEnd } = req.body; // Flag to indicate if this is an auto-end due to all tracks guessed

    // Fetch lobby document
    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbySnap = await lobbyRef.get();
    if (!lobbySnap.exists) {
      return res.status(404).json({ error: 'Lobby not found' });
    }

    const lobbyData = lobbySnap.data() as {
      hostFirebaseUid?: string;
      startedAt?: admin.firestore.Timestamp | Date | null;
      createdAt?: admin.firestore.Timestamp | Date | null;
      players?: Record<string, { name?: string }>;
      correctlyGuessedTracks?: Record<string, boolean>;
      playerScores?: Record<string, number>;
      playlistId?: string | null;
    };

    // For auto-end, verify all tracks are guessed instead of host check
    if (autoEnd) {
      // Get playlist to check total tracks
      const playlistRef = db.collection('playlists').doc(lobbyId);
      const playlistSnap = await playlistRef.get();
      if (playlistSnap.exists) {
        const playlistData = playlistSnap.data();
        const totalTracks = Object.keys(playlistData?.songs || {}).length;
        const guessedTracks = Object.keys(lobbyData.correctlyGuessedTracks || {}).length;
        
        if (totalTracks === 0 || guessedTracks !== totalTracks) {
          return res.status(400).json({ error: 'Not all tracks have been guessed' });
        }
      }
    } else {
      // Manual end - verify host
      const callerUid = (req as unknown as { user?: { uid?: string } }).user?.uid || null; // assuming auth middleware sets req.user
      if (callerUid && lobbyData.hostFirebaseUid && callerUid !== lobbyData.hostFirebaseUid) {
        return res.status(403).json({ error: 'Only the host can end the game' });
      }
    }

    // Determine winner & stats
    const scores: Record<string, number> = lobbyData.playerScores || {};
    // Determine highest score and find all players who have it (handle ties)
    let maxScore = -Infinity;
    for (const sc of Object.values(scores)) {
      if ((sc as number) > maxScore) maxScore = sc as number;
    }
    const winnerIds: string[] = Object.entries(scores)
      .filter(([, sc]) => (sc as number) === maxScore)
      .map(([pid]) => pid);

    const resultDoc = {
      lobbyId,
      hostId: lobbyData.hostFirebaseUid,
      endedAt: admin.firestore.FieldValue.serverTimestamp(),
      durationSec: lobbyData.startedAt && lobbyData.createdAt ?
        Math.floor((
          ((lobbyData.startedAt instanceof admin.firestore.Timestamp) ? lobbyData.startedAt.toDate() : (lobbyData.startedAt as Date)).getTime() -
          ((lobbyData.createdAt instanceof admin.firestore.Timestamp) ? lobbyData.createdAt.toDate() : (lobbyData.createdAt as Date)).getTime()
        )/1000) : null,
      finalScores: scores,
      players: lobbyData.players || {},
      winnerIds,
      playlistId: lobbyData.playlistId || null,
      autoEnded: autoEnd || false
    };

    // Write game result BEFORE deleting lobby (to keep data)
    await db.collection('party_results').doc(lobbyId).set(resultDoc);

    // Stop any active watcher
    trackWatcherManager.stopWatcher(lobbyId);

    // Delete lobby to clean up and stop snapshot updates
    await lobbyRef.delete();

    res.json({ success: true, result: resultDoc });
  } catch (error) {
    console.error('Error ending game:', error);
    res.status(500).json({ error: 'Failed to end game' });
  }
}) as RequestHandler);

// NEW: Watcher management endpoints for monitoring
app.get('/api/watchers/status', ((_req, res) => {
  res.json({
    activeWatchers: trackWatcherManager.getWatcherCount(),
    maxConcurrency: parseInt(process.env.WATCHER_MAX_CONCURRENCY || '500')
  });
}) as RequestHandler);

app.get('/api/watchers/:lobbyId', ((req, res) => {
  const { lobbyId } = req.params;
  const info = trackWatcherManager.getWatcherInfo(lobbyId);
  res.json(info);
}) as RequestHandler);

// Debug endpoint to check watcher status
app.get('/api/debug/watcher/:lobbyId', (req, res) => {
  const { lobbyId } = req.params;
  const info = trackWatcherManager.getWatcherInfo(lobbyId);
  res.json(info);
});

// Health check endpoint for monitoring watchers
app.get('/api/health/watchers', (req, res) => {
  const watcherCount = trackWatcherManager.getWatcherCount();
  res.json({
    activeWatchers: watcherCount,
    timestamp: new Date().toISOString(),
    status: 'healthy'
  });
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8888;
app.listen(PORT, () => {
  console.log(`Spotify auth server running on port ${PORT}`);
  console.log(`Track watcher manager initialized with max concurrency: ${process.env.WATCHER_MAX_CONCURRENCY || '500'}`);
});

// Verify if current user is host of specific lobby
app.get('/auth/verify-host/:lobbyId', (async (req, res) => {
  const { lobbyId } = req.params;
  const accessToken = req.cookies.spotify_access_token;
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  try {
    // Get current user's Spotify ID
    const userResponse = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    
    const spotifyUserId = userResponse.data.id;
    
    // Check if this user is the host of the lobby
    const watcherInfo = trackWatcherManager.getWatcherInfo(lobbyId) as { exists: boolean; hostSpotifyUserId?: string };
    const isHost = watcherInfo.exists && watcherInfo.hostSpotifyUserId === spotifyUserId;
    
    res.json({ isHost, spotifyUserId });
  } catch (error) {
    console.error('Error verifying host status:', error);
    res.status(500).json({ error: 'Failed to verify host status' });
  }
}) as RequestHandler);