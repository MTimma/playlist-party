import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SpotifyCallback.css';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    const handleCallback = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/callback${window.location.search}`, {
          credentials: 'include',
          signal: controller.signal,
          headers: {
            'Accept': 'application/json'
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Authentication failed');
        }

        const data = await response.json();
        if (data.success) {
          navigate('/');
        } else {
          throw new Error('Authentication failed');
        }
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            setError('Request timed out. Please try again.');
          } else {
            setError(err.message);
          }
        } else {
          setError('Authentication failed');
        }
        setTimeout(() => navigate('/'), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  if (error) {
    return (
      <div className="spotify-callback error">
        <h2>Authentication Error</h2>
        <p>{error}</p>
        <p>Redirecting to home page...</p>
      </div>
    );
  }

  return (
    <div className="spotify-callback loading">
      <div className="spinner"></div>
      <p>Authenticating with Spotify...</p>
    </div>
  );
};

export default SpotifyCallback; 