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



--- 5. when spotify user authenticates need to route to existing game if there is
### Analysis & Implementation Plan

The goal is to improve user experience post-OAuth by returning the player **directly to the lobby or game they were already part of**, instead of the generic home page.

1. Where we are now  
   • `SpotifyCallback.tsx` performs the code-exchange then always `navigate('/')`.  
   • No persisted pointer to “my current lobby”.  
   • All Firestore subscriptions are keyed by `lobbyId` that comes from the URL; if we don’t change the URL the game won’t resume.

2. Persist the last active lobby  
   a) Front-end quick win (stateless backend) — **LocalStorage**:  
   ```ts
   // when a player joins or creates a lobby
   localStorage.setItem('activeLobbyId', lobbyId);
   ```
   b) More robust (multi-device) — **Backend endpoint**: store `{ userId, lobbyId }` in Redis/Firestore and expose `GET /api/me/active-lobby`.

3. Extend `SpotifyCallback`  
   ```ts
   const activeLobby = localStorage.getItem('activeLobbyId');
   if (activeLobby) {
     navigate(`/game/${activeLobby}`);
   } else {
     // fallback
     navigate('/');
   }
   ```
   • If the backend variant is preferred call `fetch(`${VITE_BACKEND_URL}/api/me/active-lobby`)` instead.  
   • **Edge-case**: lobby might be closed → 404; handle by clearing the key & redirecting home.

4. Update join/create flows to clear the key when the game ends or the player leaves.  
   ```ts
   // on leave-lobby or after host ends game
   localStorage.removeItem('activeLobbyId');
   ```

5. Routing guard (optional)  
   Add a small hook in `App.tsx` that, on mount, checks the key and auto-redirects, so a user refreshing the page still lands in the game.

#### “Underwater Stones”
• Stale lobbyId pointing to a deleted document ⇒ always validate against Firestore before navigating.  
• Multiple active lobbies (user plays in two tabs) ⇒ decide whether to store *last* or *array* of lobbyIds.  
• Privacy: do not write Spotify access tokens to localStorage, only the harmless lobbyId.  
• Race-condition between OAuth callback and Firestore write that creates the lobby entry — add a retry/backoff or spinner.


--- 6. in game for host need buttons to end the game. Then show to all players the result score of the game.
### Analysis & Implementation Plan
Based on my analysis, here's a comprehensive breakdown of what's needed for the end game feature:
Create POST /api/game/:lobbyId/end endpoint to handle game ending with host authentication, status update to 'finished', final scores capture, and watcher cleanup
Create game_results Firestore collection to store historical game results with lobbyId, players, finalScores, winnerId, endedAt, and duration
Add 'End Game' button in Game.tsx for host with confirmation dialog and handleEndGame function
Implement automatic game ending when all tracks in playlist are correctly guessed
Create EndGameSummary component to display final scores, winner announcement, and play again options
Add react-canvas-confetti library and implement winner celebration animation
Delete lobby record on game end to stop watcher polling and clean up resources
Implement game results retrieval on URL opening to show past game results
Analysis: End Game Feature Requirements
Based on my thorough code analysis, here's what needs to be implemented for the end game feature:
Current State
The game has a 'finished' status defined in types but it's not being used
There's a 'terminated_by_host' status that shows a simple message but doesn't preserve game results
The scoreboard is already tracking scores in real-time (playerScores in lobby document)
The game tracks which songs have been correctly guessed (correctlyGuessedTracks)
No end game button exists for the host
No celebration/confetti animation for winners
No historical game results storage
Required Features
*Create POST /api/game/:lobbyId/end endpoint to handle game ending with host authentication, status update to 'finished', final scores capture, and watcher cleanup
Create game_results Firestore collection to store historical game results with lobbyId, players, finalScores, winnerId, endedAt, and duration
Add 'End Game' button in Game.tsx for host with confirmation dialog and handleEndGame function
Implement automatic game ending when all tracks in playlist are correctly guessed
Create EndGameSummary component to display final scores, winner announcement, and play again options
Add react-canvas-confetti library and implement winner celebration animation
Delete lobby record on game end to stop watcher polling and clean up resources
Implement game results retrieval on URL opening to show past game results

1. Backend End Game Endpoint
Create POST /api/game/:lobbyId/end endpoint that:
Validates the caller is the host (using Firebase auth)
Updates lobby status to 'finished'
Captures final scores and winner information
Stops the track watcher to prevent Spotify polling
Creates a game result record for historical tracking
2. Game Results Database Table
New Firestore collection: game_results
Schema:
interface GameResult {
    id: string;
    lobbyId: string;
    hostId: string;
    endedAt: Timestamp;
    duration: number; // in seconds
    finalScores: Record<string, number>;
    players: Record<string, { name: string; score: number }>;
    winnerId: string;
    winnerName: string;
    totalTracksGuessed: number;
    playlistId?: string;
  }
3. Frontend End Game Button
Only visible to the host
Positioned in the game header or control area
Includes confirmation dialog to prevent accidental clicks
Triggers the end game API call
4. Auto-End When All Songs Guessed
Monitor correctlyGuessedTracks length vs total playlist songs
Automatically trigger game end when all tracks are guessed
No need for host intervention in this case
5. End Game Summary Component
New component: EndGameSummary
Displays:
Final scoreboard with winner highlighted
Confetti animation for the winner
Game statistics (duration, tracks guessed, etc.)
"Play Again" button for host
"Home" button for all players
6. Confetti Animation
Install react-canvas-confetti package
Trigger on game end when showing the winner
Customizable colors and duration
7. Lobby Cleanup
Delete the lobby document after creating the game result
This automatically stops the watcher polling
Clear localStorage references
8. Results Persistence & Retrieval
When opening a game URL after it's finished:
Check if lobby exists
If not, check game_results collection
Display the final results if found
Show "Game not found" if neither exists
Implementation Considerations
Security
Only host can end the game manually
Validate all score calculations server-side
Use Firestore transactions to prevent race conditions
Performance
The track watcher cleanup is critical to stop unnecessary Spotify API calls
Consider batching the final cleanup operations
Use proper indexes on game_results collection
User Experience
Clear visual feedback when game ends
Smooth transition to results screen
Prevent accidental game ending with confirmation
Handle network failures gracefully
Edge Cases to Handle
Host disconnection during game end
Players still trying to guess during transition
Multiple end game requests (double-click protection)
Game ending with no correct guesses
Tie scenarios for winner determination
This implementation will provide a complete end game flow with proper cleanup, historical tracking, and an engaging celebration for the winner. 


#### “Underwater Stones”
• Race conditions: two hosts (edge-case) click end simultaneously ⇒ use Firestore `runTransaction`/backend mutex.  
• Players still guessing during the final seconds; validate server-side that `status === 'in_progress'` before accepting a guess.  
• Ensure scoreboard stops updating to avoid flicker after freeze (unsubscribe or check `status`).  
• Performance: big lobbies could have thousands of players → paginate or virtualise the final table.  
• Security: backend must verify the caller’s auth cookie and host role before writing the end marker — **never** trust the button alone.  
• Mobile UX: place the end-game button in a confirmation dialog to prevent accidental taps.

