import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SpotifyCallback.css';

const SpotifyCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    
    if (error) {
      setError(`Authentication failed: ${error}`);
      setTimeout(() => navigate('/'), 3000);
      return;
    }

    // Check if authentication was successful by trying to get auth status
    const checkAuthSuccess = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/auth/status`, {
          credentials: 'include',
        });
        const data = await response.json();
        
        if (data.isAuthenticated) {
          // Redirect to home page on successful authentication
          setTimeout(() => navigate('/'), 1500);
        } else {
          setError('Authentication was not successful. Please try again.');
          setTimeout(() => navigate('/'), 3000);
        }
      } catch (err) {
        setError('Failed to verify authentication status.');
        setTimeout(() => navigate('/'), 3000);
      }
    };

    checkAuthSuccess();
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
      <p>Authentication successful! Redirecting...</p>
    </div>
  );
};

export default SpotifyCallback; 