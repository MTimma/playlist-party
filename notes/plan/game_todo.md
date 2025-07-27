Todos for Game.tsx

1. ✅ COMPLETED: Need to check if playing song is from the lobby playlist, if yes - in the playlist record check who added the song and populate buttons for guessing (except the player who addded)
Here’s what has to change (and why) to satisfy item 1 in notes/plan/game_todo.md.
Front-end: src/components/Game/Game.tsx
Detect whether the song the host is currently playing belongs to the lobby’s playlist.
You already hold the track’s URI (currentTrack.uri) and the full playlist collection in playlistCollection.
Add a guard such as
Apply to game_todo.md
       const inPlaylist = !!playlistCollection?.songs[currentTrack.uri];
;
Obtain the owner (addedBy) for that URI via the helper you started (getTrackOwner).
Render a new GuessButtons component only when all of these are true:
inPlaylist is true
guessing hasn’t been disabled (!lobby.disableGuessing)
the current user is not the track’s owner (owner can’t guess)
the player hasn’t already guessed for this track (query backend; see point 4)
Remove (or leave hidden) the guessing UI otherwise.
Code locations to touch are around the existing TODO:
   {/* TODO: Add GuessButtons component here */}
   <div className="guessing-section">
   ...
.
New component: src/components/GuessButtons/GuessButtons.tsx
Create a folder src/components/GuessButtons and place GuessButtons.tsx + GuessButtons.css inside (keeps to your “one folder per component” convention).
Props should include
players: { [id: string]: Player } (from lobby.players)
excludedPlayerId (the track owner)
onGuess(ownerId: string) callback.
Render one button per eligible player (every player except excludedPlayerId).
Disable the button while the backend call is pending; show success/error feedback.
Front-end service wrapper
You already have validateGuess and checkPlayerGuess in src/services/backend.ts.
In Game.tsx call checkPlayerGuess when the track changes; store hasGuessed in state so the UI hides once a guess is made.
Wire onGuess from GuessButtons to validateGuess; afterwards update local state to prevent multiple guesses.
State types
Guess interface already exists in src/types/types.ts; no changes needed unless you expose more fields to the UI (e.g., scoreChange).
Styling
Add GuessButtons.css for layout (grid / flex row of buttons) inside the new folder and import it in GuessButtons.tsx.
Optionally extend Game.css to accommodate the new section.
(Optional) Server-side adjustments
The Express endpoint /api/game/validate-guess is already implemented and adds scores, so no server change is strictly required for this item.
If you want to enforce a “guess window” (e.g., 30 s after a song starts) honour lobby.guessWindowMs in the frontend by comparing progressMs.
Where you will be coding:
Game.tsx (logic + conditional render)
NEW src/components/GuessButtons/… (UI)
Maybe small additions in src/components/Game/Game.css and src/services/backend.ts (error handling helpers).
No other existing files need modification for this task.
(Everything above is inferred from the current codebase; please double-check method/prop names if you renamed anything later.)


2. Need to initialize and keep score

Current State Analysis
The scoring infrastructure is partially implemented:

Backend has score update logic in /api/game/validate-guess endpoint
Firebase structure includes playerScores field in lobby document
Types are defined (PlayerScore, scoring in Player interface)
Frontend subscription function exists (subscribePlayerScores)
Game component has placeholder for score display
Implementation Plan
1. Score State Management
Frontend (Game.tsx):

// Add to Game component state
const [playerScores, setPlayerScores] = useState<Record<string, number>>({});

// Subscribe to score updates from lobby document
useEffect(() => {
  if (!lobby?.playerScores) return;
  setPlayerScores(lobby.playerScores);
}, [lobby?.playerScores]);
2. ScoreBoard Component Creation
Create src/components/ScoreBoard/ScoreBoard.tsx:

Display real-time scores for all players
Sort players by score (descending)
Highlight current player
Show score changes with animations
3. Score Update Flow
Current Implementation Issues:

Score is stored in lobby.playerScores as a map
Individual player objects also have a score field (redundancy)
No score history or round-based tracking
Recommended Architecture:

// In Firestore
/lobbies/{lobbyId}
  ├─ playerScores: { [playerId]: number }  // Aggregate scores
  ├─ currentRound: number
  └─ rounds/
      └─ {roundNumber}/
          └─ scores: { [playerId]: number }  // Round-specific scores
Potential "Underwater Stones" and Solutions
1. Race Conditions
Problem: Multiple players guessing simultaneously on the same track

Player A and B click guess buttons milliseconds apart
Both requests hit the backend before the first guess is recorded
Potential double-scoring or inconsistent state
Solution:

// Use Firestore transactions
await db.runTransaction(async (transaction) => {
  // Check if player already guessed
  const guessQuery = await transaction.get(
    db.collection('lobbies').doc(lobbyId)
      .collection('guesses')
      .where('playerId', '==', playerId)
      .where('trackUri', '==', trackUri)
  );
  
  if (!guessQuery.empty) {
    throw new Error('Already guessed');
  }
  
  // Create guess and update score atomically
  transaction.set(guessRef, guessData);
  transaction.update(lobbyRef, {
    [`playerScores.${playerId}`]: FieldValue.increment(scoreChange)
  });
});
2. Database Overload
Problem: Real-time score updates for many concurrent games

Each guess triggers multiple database writes
Score animations require frequent reads
Potential Firestore quota exhaustion
Solutions:

Batching: Aggregate score updates every 500ms instead of instant
Local State: Optimistically update UI before server confirmation
Caching: Use Firebase offline persistence
Rate Limiting: Implement per-player guess cooldown (1 guess per 2 seconds)
3. Backend Request Flooding
Problem: Rapid clicking or network retries

Users spam-clicking guess buttons
Network failures causing automatic retries
Potential server overload
Solutions:

// Frontend debouncing
const [isGuessing, setIsGuessing] = useState(false);
const [lastGuessTime, setLastGuessTime] = useState(0);

const handleGuess = async (guessedOwnerId: string) => {
  const now = Date.now();
  if (isGuessing || now - lastGuessTime < 2000) return;
  
  setIsGuessing(true);
  try {
    await validateGuess(lobbyId, playerId, trackUri, guessedOwnerId);
    setLastGuessTime(now);
  } finally {
    setIsGuessing(false);
  }
};
4. Score Consistency Issues
Problem: Score drift between client and server

Network delays causing out-of-sync scores
Firebase eventually-consistent reads
Score updates lost during disconnections
Solutions:

Single Source of Truth: Always trust server scores over local
Reconciliation: On reconnect, fetch latest scores
Audit Trail: Log all score changes with timestamps
5. Concurrent Game State Updates
Problem: Track changes while players are guessing

Host skips to next track while guesses are in-flight
Score applied to wrong round
Guess validation against outdated track
Solution:

// Include round number in guess validation
interface GuessValidation {
  lobbyId: string;
  playerId: string;
  trackUri: string;
  guessedOwnerId: string;
  currentRound: number; // Add this
}

// Server validates round hasn't changed
if (lobby.currentRound !== guessData.currentRound) {
  throw new Error('Round has ended');
}
Implementation Checklist
Immediate Actions:

[ ] Create ScoreBoard component with real-time updates
[ ] Add score state management to Game component
[ ] Implement client-side guess debouncing
[ ] Add loading states for guess submissions
Backend Improvements:

[ ] Wrap score updates in Firestore transactions
[ ] Add round validation to guess endpoint
[ ] Implement rate limiting middleware
[ ] Add score audit logging
Performance Optimizations:

[ ] Batch score update notifications
[ ] Implement local score caching
[ ] Add connection state monitoring
[ ] Use Firebase offline persistence
Error Handling:

[ ] Handle network failures gracefully
[ ] Show clear error messages to users
[ ] Implement automatic retry with backoff
[ ] Add score reconciliation on reconnect
Testing:

[ ] Simulate concurrent guesses
[ ] Test with poor network conditions
[ ] Verify score consistency across clients
[ ] Load test with multiple simultaneous games
Security Considerations
Score Tampering: All score calculations must happen server-side
Guess Validation: Verify player hasn't already guessed for current track
Authentication: Ensure playerId matches authenticated user
Rate Limiting: Prevent guess spam attacks


3. too many requests during guessing

The spike in traffic is coming from a feedback-loop between the server-side “watcher” that polls Spotify every second and the way Game.tsx reacts to the resulting Firestore updates.
What the watcher does
TrackWatcherManager starts one interval timer per lobby (pollMs defaults to 1000 ms).
Every tick it calls the Spotify “currently-playing” API, then unconditionally writes a document update to
lobbies/{lobbyId} – even when nothing about the track actually changed (it always writes progressMs and updatedAt).
With several active lobbies this alone can push hundreds of writes / external requests per minute.
How the frontend multiplies those writes into extra HTTP calls
Game.tsx subscribes to that lobby document (subscribeLobby).
On every snapshot it rebuilds a fresh track object and calls setCurrentTrack(track) (see lines 77-97 of the file).
Even if the song hasn’t changed the object reference is new each time.
Another useEffect is keyed on [lobbyId, currentUserId, currentTrack] (lines 54-68).
Because currentTrack is a new object every second, the effect fires every second and executes
checkPlayerGuess(...), which issues
GET /api/game/:lobbyId/guess/:trackUri?playerId=….
Result: the browser hammers /api/game/.../guess once per second per player that is on the game screen.
Side-effects on the backend
Extra load on your Express server and Firestore (read & write).
Spotify API limits (~100 reqs / sec / client) can be hit fast if many watchers run at once.
You may also see 429s or “too many requests” warnings in browser dev-tools (one per GET guess check).
Why you see “too many requests” symptoms
 a) The server is already polling Spotify every second. 
 b) Each poll triggers a Firestore write. 
 c) Each write triggers every client to re-render. 
 d) Each re-render triggers a new guess-status fetch. 
 → N players × 60 requests/minute per lobby, on top of the Spotify polling.
How to verify quickly
Put a console.count('guessCheck') inside checkGuessStatus in Game.tsx → you will see it increment every second.
Observe network tab: /api/game/.../guess appears in a steady stream.
Key fixes (next steps, not done yet)
In Game.tsx compare the new currentTrack.uri with the previous one and call setCurrentTrack only when it changes; change the effect dependency to [lobbyId, currentUserId, currentTrack?.uri].
Alternatively, cache the “has guessed” flag in component state and refresh it only when the song changes.
Implementing any of those will collapse the extra round-trip traffic and remove the “too many requests” issue.

4. DONE
there is something buggy with song progress, it jumps up by 2 and then goes down by one second, so if it was 0:01, it would be 0:03 millisecond nad then changes to 0:02

this was seeen first when testing parallel lobbies