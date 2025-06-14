import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Lobby } from './components/Lobby/Lobby';
import { Game } from './components/Game/Game';
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Lobby />} />
        <Route path="/game/:gameId" element={<Game />} />
      </Routes>
    </Router>
  );
}

export default App;
