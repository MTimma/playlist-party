import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Lobby } from './components/Lobby/Lobby';
import { CreateLobby } from './components/Host/CreateLobby';
import { JoinLobby } from './components/Player/JoinLobby';
import { Party } from './components/Party/Party';
import SpotifyCallback from './components/SpotifyCallback/SpotifyCallback';
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { LanguageSwitcher } from './components/LanguageSwitcher/LanguageSwitcher';
import './App.css'

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <Router>
          <LanguageSwitcher />
          <Routes>
            <Route path="/" element={<CreateLobby />} />
            <Route path="/create" element={<CreateLobby />} />
            <Route path="/join" element={<JoinLobby />} />
            <Route path="/lobby/:lobbyId" element={<Lobby />} />
            <Route path="/party/:lobbyId" element={<Party />} />
            <Route path="/callback" element={<SpotifyCallback />} />
          </Routes>
        </Router>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
