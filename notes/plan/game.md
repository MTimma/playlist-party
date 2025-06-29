# Sprint: Game Play & Scoring
_Status: Planning Phase_

## As a player
I want a real-time game view
So that I can guess who added the currently playing song and earn points

---

## Acceptance Criteria
1. **Game View Activation**
   • Component `Game` renders when `lobbies/{id}.status === 'in_progress'`.
2. **Host Playback Detection**
   • Backend polls Spotify *Currently Playing* endpoint every 3 s **or** consumes a Web Playback SDK event.<br/>
   • Writes `currentTrackUri`, `progressMs`, and `isPlaying` to `/games/{lobbyId}/state`.
3. **Waiting State**
   • If `isPlaying === false`, all clients show "Waiting for host to start the playlist…".
4. **Current Track Display**
   • Shows album art, title, artists, and a live progress bar (±1 s accuracy).
5. **Guessing Mechanic**
   • Each player sees one button per **other** player (owner excluded).<br/>
   • First correct guess within *guessWindowMs* (default 30 000 ms) earns **3 points**; later correct guesses earn **1 point**.<br/>
   • Wrong guess → −1 point for the guesser and they cannot guess again that round.
6. **Real-time Sync**
   • When a correct guess is recorded, UI highlights the winner and disables further guesses client-wide within 1 s.
7. **Scoreboard**
   • Compact section shows all players' points, updated in real-time.
8. **Round Advancement**
   • Upon track change, `currentRound`++, guess buttons reset; after last track, `lobbies/{id}.status → 'finished'`.
9. **Accessibility & UX**
   • Guess buttons fully keyboard-navigable; ARIA live-region announces round winner.
10. **Security**
    • Guess docs can only be created by the authenticated guesser.<br/>
    • All score mutations executed server-side (Cloud Function) to prevent tampering.

---

## Overview
Build the core real-time gameplay loop, connecting Spotify playback, Firestore state, and the guessing & scoring system.

---

## Core Features
1. Host playback watcher (Cloud Function or backend cron)
2. Shared game state in Firestore
3. Player guessing interface & validation
4. Centralised scoring logic
5. Live scoreboard & round management

---

## Data Models
```typescript
interface GameState {
  lobbyId: string;
  currentTrackUri: string;
  currentRound: number;
  trackOwnerId: string;
  isPlaying: boolean;
  progressMs: number;
  startedAt: Timestamp;
  endedAt?: Timestamp;
  guessWindowMs: number; // default 30000
}

interface Guess {
  id: string;          // auto-id
  playerId: string;    // who guessed
  trackUri: string;    // which track
  guessedOwnerId: string;
  isCorrect: boolean;
  createdAt: Timestamp;
}

interface PlayerScore {
  playerId: string;
  score: number;
}
```

---

## Firebase Structure
```
/games/{lobbyId}
  ├─ state           // GameState document
  ├─ guesses/
  │   └─ {guessId}  // Guess documents
  └─ scores/
      └─ {playerId} // PlayerScore documents
```

---

## Cloud Functions
1. **onCurrentTrackChange** – Triggered by backend playback watcher; updates `/games/{id}/state`, derives `trackOwnerId` from playlist metadata.
2. **onGuessCreated** – Validates guess, marks correctness, allocates points, writes to `/scores`.
3. **onGameEnd** – Detects last track, aggregates final scores, sets `lobbies/{id}.status = 'finished'`.

All secrets (Spotify tokens) remain server-side; functions use environment variables (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`) already configured.

---

## Components (Frontend)
| Component | Location | Responsibility |
|-----------|----------|----------------|
| `Game/` | `src/components/Game/` | Container route, renders child components based on `GameState`. |
| `TrackInfo/` | `src/components/TrackInfo/` | Displays current track details & progress. |
| `GuessButtons/` | `src/components/GuessButtons/` | Renders dynamic buttons for guessing; disables after selection. |
| `ScoreBoard/` | `src/components/ScoreBoard/` | Real-time player points list. |

*Follow user rule: each component in its own folder with matching CSS file.*

---

## Implementation Steps
### Phase 4: Real-time Game View (2 days)
1. Create `Game` route & listen to `/games/{id}/state`.
2. Implement `TrackInfo` with live progress bar.
3. Render "Waiting for host…" banner when `isPlaying` is false.

### Phase 5: Guessing & Scoring (2 days)
1. Build `GuessButtons` component with eligibility logic.
2. Cloud Function `onGuessCreated` to score guesses atomically.
3. Implement `ScoreBoard` subscribing to `/scores`.

### Phase 6: Hardening & UX Polish (1 day)
1. Add keyboard navigation & ARIA announcements.
2. Optimise playback polling; fallback to Webhooks if Spotify releases them.
3. Handle edge cases (track without owner, host skips song, etc.).

---

## Testing Focus
• **Unit Tests**: Components render logic, disabled states, accessibility.
• **Cloud Functions**: Guess validation, scoring, concurrency (Vitest + emulator).
• **Integration Tests**: Two browsers guessing concurrently; latency < 1 s.
• **Security Rules Tests**: Only authorised writes to `/guesses` & `/scores`.
• **Coverage Goal**: ≥ 90 % lines.

---

## Success Criteria
✓ Host playback accurately detected and synced in < 2 s.
✓ Current track & owner displayed to all players.
✓ Guessing works; first correct guess rewarded, others handled.
✓ Scoreboard updates in real-time across clients.
✓ All Firebase rules tests pass.
✓ No secrets leak to the client; follows Spotify & industry security standards.

---

## Notes & Cautions
• Spotify playback API can be delayed (~1 s). Compensate with progressMs.
• *Imagined endpoints*: `/games/{id}/state`, `onGuessCreated` – verify final naming in implementation.
• Be wary of rate limits: 1 request / sec per host for playback polling is sufficient.
• Points algorithm is configurable; expose constants in `src/constants/game.ts`.
