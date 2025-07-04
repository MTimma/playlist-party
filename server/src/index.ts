import express from 'express';
import type { Request, Response } from 'express';
import axios, { AxiosError } from 'axios';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';

dotenv.config();

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
const REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI!;
const FRONTEND_URL = process.env.FRONTEND_URL!;
const SPOTIFY_ACCOUNTS_URL = process.env.SPOTIFY_ACCOUNTS_URL || 'https://accounts.spotify.com';

// Cache for client credentials token
interface ClientCredentialsCache {
  token: string;
  expiresAt: number;
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

// Spotify Web API error payload (subset)
interface SpotifyApiErrorResponse {
  error: {
    status?: number;
    message?: string;
  };
}

// Narrow unknown error to AxiosError<SpotifyApiErrorResponse>
const isSpotifyAxiosError = (
  err: unknown,
): err is AxiosError<SpotifyApiErrorResponse> => axios.isAxiosError(err);

// 1. Redirect user to Spotify login
app.get('/login', (_req: Request, res: Response) => {
  const scope = [
    'user-read-private',
    'user-read-email',
    'streaming',
    'user-modify-playback-state',
    'user-read-playback-state',
    'playlist-modify-private',
    'playlist-modify-public'
  ].join(' ');
  const authUrl = `${SPOTIFY_ACCOUNTS_URL}/authorize?response_type=code&client_id=${CLIENT_ID}&scope=${encodeURIComponent(scope)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}`;
  res.redirect(authUrl);
});

// 2. Handle Spotify callback and exchange code for tokens
app.get('/callback', (req: Request, res: Response) => {
  (async () => {
    const code = req.query.code as string | undefined;
    if (!code) return res.status(400).send('Missing code');

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
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
      if (isSpotifyAxiosError(err)) {
        const status = err.response?.status ?? err.response?.data?.error?.status;
        res.status(status ?? 500).json({
          error: 'Failed to get tokens',
          details: err.response?.data?.error?.message ?? err.message,
        });
      } else if (err instanceof Error) {
        res.status(500).json({ error: 'Failed to get tokens', details: err.message });
      } else {
        res.status(500).json({ error: 'Failed to get tokens', details: 'Unknown error' });
      }
    }
  })();
});

// 3. Get current access token
app.get('/auth/token', (req: Request, res: Response): void => {
  try {
    const accessToken = req.cookies.spotify_access_token;
    if (!accessToken) {
      void res.status(401).json({ error: 'No access token' });
      return;
    }
    res.json({ accessToken });
  } catch {
    res.status(500).json({ error: 'Failed to get token' });
  }
});

// 4. Check authentication status
app.get('/auth/status', (req: Request, res: Response) => {
  const accessToken = req.cookies.spotify_access_token;
  res.json({ isAuthenticated: !!accessToken });
});

// 5. Logout
app.post('/auth/logout', (_req: Request, res: Response) => {
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

app.get('/me', async (req: Request, res: Response): Promise<void> => {
  const accessToken = req.cookies.spotify_access_token;
  if (!accessToken) {
    void res.status(401).json({ error: 'No access token' });
    return;
  }
  try {
    const userRes = await axios.get('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    res.json(userRes.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// 7. Create playlist endpoint
app.post('/api/spotify/playlist', async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('=== Playlist Creation Request ===');
    console.log('Cookies received:', req.cookies);
    console.log('Headers:', req.headers);
    
    const accessToken = req.cookies.spotify_access_token;
    console.log('Access token found:', !!accessToken);
    
    if (!accessToken) {
      console.log('No access token in cookies');
      void res.status(401).json({ error: 'No access token' });
      return;
    }

    const { name, description = 'Generated by Music Game', trackUris = [] } = req.body;
    
    if (!name || typeof name !== 'string') {
      void res.status(400).json({ error: 'Playlist name is required' });
      return;
    }

    if (name.length < 1 || name.length > 100) {
      void res.status(400).json({ error: 'Playlist name must be 1-100 characters' });
      return;
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

    res.json({
      success: true,
      playlist,
      tracksAdded: trackUris.length
    });
    console.log('Playlist created');
  } catch (err: unknown) {
    console.error('Playlist creation error:', err);
    if (isSpotifyAxiosError(err)) {
      const status = err.response?.status ?? err.response?.data?.error?.status;
      if (status === 401) {
        res.status(401).json({ error: 'Spotify authentication expired' });
      } else if (status === 403) {
        res.status(403).json({ error: 'Insufficient Spotify permissions' });
      } else if (status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded, please try again later' });
      } else {
        res.status(500).json({ error: 'Failed to create playlist', details: err.response?.data?.error?.message ?? err.message });
      }
    } else {
      res.status(500).json({ error: 'Failed to create playlist' });
    }
  }
});

// 8. Search tracks endpoint (using client credentials)
app.get('/api/spotify/search', searchLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { q, type = 'track', limit = '10' } = req.query;
    
    if (!q || typeof q !== 'string') {
      void res.status(400).json({ error: 'Query parameter is required' });
      return;
    }
    
    if (q.trim().length === 0) {
      void res.json({ tracks: [] });
      return;
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
    
    // Explicitly type the Spotify track item we expect from the API
    interface SpotifyArtist {
      name: string;
      id: string;
    }

    interface SpotifyAlbumImage {
      url: string;
      height: number;
      width: number;
    }

    interface SpotifyAlbum {
      name: string;
      images: SpotifyAlbumImage[];
    }

    interface SpotifyTrackItem {
      uri: string;
      name: string;
      artists: SpotifyArtist[];
      duration_ms: number;
      preview_url: string | null;
      album: SpotifyAlbum;
    }

    // Transform the response to match our local Track interface
    const apiTracks = (searchResponse.data.tracks?.items ?? []) as SpotifyTrackItem[];

    const tracks = apiTracks.map((track) => ({
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist) => ({
        name: artist.name,
        id: artist.id,
      })),
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      album: {
        name: track.album.name,
        images: track.album.images.map((img) => ({
          url: img.url,
          height: img.height,
          width: img.width,
        })),
      },
    }));
    
    res.json({ tracks });
    
  } catch (err: unknown) {
    console.error('Search error:', err);
    if (isSpotifyAxiosError(err)) {
      const status = err.response?.status ?? err.response?.data?.error?.status;
      if (status === 429) {
        res.status(429).json({ error: 'Rate limit exceeded, please try again later' });
      } else if (status === 401) {
        // Clear cache and retry once
        clientCredentialsCache = null;
        res.status(500).json({ error: 'Authentication failed, please try again' });
      } else {
        res.status(500).json({ error: 'Search failed', details: err.response?.data?.error?.message ?? err.message });
      }
    } else {
      res.status(500).json({ error: 'Search failed, please try again' });
    }
  }
});

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8888;
app.listen(PORT, () => {
  console.log(`Spotify auth server running on port ${PORT}`);
});