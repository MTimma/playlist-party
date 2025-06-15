import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import SpotifyCallback from './components/SpotifyCallback/SpotifyCallback';
import { AuthProvider } from './contexts/AuthContext';
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/callback" element={<SpotifyCallback />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
