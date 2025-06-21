import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Lobby } from './components/Lobby/Lobby';
import { CreateLobby } from './components/Host/CreateLobby';
import { JoinLobby } from './components/Player/JoinLobby';
import { Game } from './components/Game/Game';
import SpotifyCallback from './components/SpotifyCallback/SpotifyCallback';
import { AuthProvider } from './contexts/AuthContext';
import './App.css'

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<CreateLobby />} />
          <Route path="/create" element={<CreateLobby />} />
          <Route path="/join" element={<JoinLobby />} />
          <Route path="/lobby/:lobbyId" element={<Lobby />} />
          <Route path="/game/:gameId" element={<Game />} />
          <Route path="/callback" element={<SpotifyCallback />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
