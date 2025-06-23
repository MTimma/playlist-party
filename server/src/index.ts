import express, { Request, Response, RequestHandler } from 'express';
import axios from 'axios';
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

// 1. Redirect user to Spotify login
app.get('/login', (_req, res) => {
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
app.get('/callback', (req, res) => {
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

      res.cookie('spotify_access_token', tokenRes.data.access_token, cookieOptions);
      res.cookie('spotify_refresh_token', tokenRes.data.refresh_token, {
        ...cookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days for refresh token
      });

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
    res.json(userRes.data);
  } catch {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
}) as RequestHandler);

// 7. Search tracks endpoint (using client credentials)
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
    const tracks = searchResponse.data.tracks?.items?.map((track: any) => ({
      uri: track.uri,
      name: track.name,
      artists: track.artists.map((artist: any) => ({
        name: artist.name,
        id: artist.id
      })),
      duration_ms: track.duration_ms,
      preview_url: track.preview_url,
      album: {
        name: track.album.name,
        images: track.album.images.map((img: any) => ({
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

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 8888;
app.listen(PORT, () => {
  console.log(`Spotify auth server running on port ${PORT}`);
});