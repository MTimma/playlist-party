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
   • Guess buttons fully keyboard-navigable.
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
| `Game/` | `src/components/party/` | Container route, renders child components based on `GameState`. |
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
1. Polish and validate keyboard navigation.
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

Below is a practical blueprint for implementing Acceptance-Criterion #6 (“Real-time Sync”) in the React front-end. It uses the Firestore SDK’s real-time listeners as the event bus, so you don’t need additional web-hooks or peer-to-peer signalling.
1. Event Flow at a Glance
1. Player clicks a Guess button →
Client writes a new document to /games/{lobbyId}/guesses/ (or calls a callable Cloud Function).
Cloud Function onGuessCreated runs atomically:
checks correctness & duplicate guesses
sets isCorrect, winnerId, roundFinishedAt, etc.
increments scores in /scores/{playerId}
updates /games/{lobbyId}/state with roundWinnerId (and maybe disableGuessing: true).
Firestore instantly streams those mutations back to every connected browser (typically 80–150 ms).
React listeners receive the change and update UI; guessing buttons get disabled and the winner is highlighted—well under the 1 s requirement.

Please review game.md if the plan is realistic and does it apply to security and industry standrads.
What is ARIA - is it needed? We already use Firebase.
We will most likely host this on AWS EC2 or similar- feel free for sugestions

Below is a structured review of notes/plan/game.md, answers about ARIA, and some hosting suggestions for an AWS-based deployment.
1. Realism of the Plan
A. Scope & Effort
Feature list and data models line up well with the typical “guess-the-song” mechanic.
Splitting the work into three 2-day phases is achievable for an experienced developer or a small team that already has the Spotify integration groundwork in place.
Unit-, integration- and security-test coverage targets (≥ 90 %) are ambitious but realistic if you enforce testing culture from the start.
B. Technical Feasibility
Firestore can comfortably handle the required document frequency (state every 3 s, guesses, scores) for a lobby-sized game.
30 s guess window and one write per player per round will not hit write limits unless you reach thousands of concurrent games.
Cloud Functions triggered by Firestore writes (onGuessCreated, etc.) are a standard pattern and atomic transactions will prevent race conditions.
Polling Spotify every 3 s with one host per lobby is within Spotify’s rate limits (currently 100 requests / 30 s per token).
C. Security & Industry-Standard Practices
✓ Secrets stay server-side; you already note using environment variables SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET.
✓ “All score mutations executed server-side” protects against client tampering.
✓ Planned Firestore security rules (“only authenticated guesser can write”) follow the principle of least privilege.
✓ Accessibility (ARIA) and keyboard navigation are explicitly called out—aligns with WCAG 2.1 AA guidelines.
✓ No hard-coded URLs or ports appear in the plan (good).
To reach “industry standard” you should also:
 • Run automated OWASP dependency scans (e.g., npm audit, npm-audit-ci, or GH Dependabot).
 • Add Content Security Policy (CSP) headers and X-Frame-Options (handled by your CDN / reverse proxy).
 • Store Firebase service-account JSON in a secret manager (Google Secret Manager, AWS Secrets Manager, or Vault).
 • Enforce HTTPS at every entry point.
2. What is ARIA & Do You Need It?
ARIA = Accessible Rich Internet Applications (WAI-ARIA) specification.
It provides additional attributes (e.g., role, aria-live, aria-label) so assistive technologies (screen readers, braille displays) can understand dynamic UIs.
Why it matters here:
Your “GuessButtons” appear/disappear or change state rapidly. Screen-reader users won’t know unless you announce changes via aria-live="polite" or similar.
The scoreboard updates in real time and the winner announcement should be in an ARIA live region.
ARIA is unrelated to Firebase; Firebase solves data transport & auth, whereas ARIA solves accessibility. If you want WCAG compliance (and to avoid excluding users with disabilities), keep the ARIA items in the plan.
3. Hosting on AWS (while still using Firebase)
You can mix Firebase (Auth, Firestore, Functions) with AWS for static hosting or container workloads. Two common set-ups:
A. Static Front-End on AWS
Build SPA with Vite → upload to S3.
Serve via CloudFront (HTTP/2, global edge cache, custom domain + ACM TLS).
Use AWS WAF for extra protection and a Lambda@Edge for security headers.
Keep Firebase Auth, Firestore, Cloud Functions exactly as is—no migration needed.
Pro: cheapest, simplest, scales to any size.
Con: you still have two consoles (AWS + Firebase).
B. Full Containerised Back-End on AWS
Package your existing server/ Node app (& any Cloud-Function logic) into a Docker image.
Push to ECR and run on:
 • ECS Fargate (serverless containers) or
 • AWS App Runner (simpler, auto SSL, auto scaling)
Use AWS Secret Manager for Spotify & Firebase credentials.
Add an Application Load Balancer (ALB) in front; terminate TLS there.
Optional: move from Firebase to Amazon services later (Amazon Cognito, DynamoDB) but not required.
Both approaches allow you to keep Firebase now and delay a full rewrite.
Cost guardrails
S3 + CloudFront will be <$10 / month for light traffic.
Fargate minimum 0.25 vCPU, 0.5 GB RAM ≈ $10-20 / month per always-on instance.
Use auto-scaling by CPU and schedule scale-to-zero outside peak times.
4. Minor Suggestions & Double-Check Points
• Verify exact Cloud Function trigger names in final implementation (onGuessCreated / onCurrentTrackChange)—I coined those; feel free to rename.
Add rate-limit back-off logic: if Spotify API returns 429, sleep + obey Retry-After.
Write an index on /games/{lobbyId}/state.currentRound if you query by round.
Consider enabling Firestore TTL on old guess documents to auto-purge after the game ends.
Run a threat model session (STRIDE) before launch—helps expose any missed attack vectors.
Enable the new Firebase App Check to block unauthenticated client app impersonation.
Bottom line
• The plan is technically sound and aligns with security & industry best practices.
ARIA is not about Firebase; it ensures your UI is inclusive—keep it in.
For AWS, either “S3 + CloudFront (+ Lambda@Edge for headers)” or “ECS Fargate / App Runner with Docker” are the simplest and industry-standard ways to host while still using Firebase services.
As always, double-check Spotify API limits and the final Firestore security rules before going live.
To reach “industry standard” you should also:
 • Run automated OWASP dependency scans (e.g., npm audit, npm-audit-ci, or GH Dependabot).
 • Add Content Security Policy (CSP) headers and X-Frame-Options (handled by your CDN / reverse proxy).
 • Store Firebase service-account JSON in a secret manager (Google Secret Manager, AWS Secrets Manager, or Vault).
 • Enforce HTTPS at every entry point.

1. can you add this to the game.md?

2. also, what about cleaning up lobbies in firebase?

3. what is screen-reaader?

4. what to do after firebase reachaes 1000 concurrent games?


Updates done:
Added five industry-standard hardening items under the existing “Security” section in notes/plan/game.md.
Below are answers to your other questions.
2. Cleaning-up finished lobbies in Firebase
Recommended pattern:
Add endedAt: Timestamp to every lobby document when the last track finishes.
Enable Firestore’s native TTL (beta → GA) on that field; pick a value like 24 h or 7 d. After the TTL period Google will automatically:
delete the lobby document, and
recursively delete its sub-collections (games/{lobbyId}, guesses, scores, etc.).
For extra safety you can run a scheduled Cloud Function (every 24 h with Cloud Scheduler) that:
queries lobbies where status == 'finished' AND endedAt < now – X,
deletes any stragglers,
logs metrics (how many purged).
This keeps your read/write costs low and prevents old data from leaking.
3. What is a screen reader?
A screen reader is assistive-technology software (e.g., NVDA, JAWS, VoiceOver) that converts on-screen content into synthesized speech or braille.
For dynamic UIs like yours it relies on semantic HTML + ARIA attributes to know:
what each element “is” (button, dialog, list, etc.),
when content changes (live-regions),
which element has focus,
how to announce alerts or status messages.
Without ARIA announcements a blind user would never hear “Round winner: Alice earned 3 pts”, even though it visually appeared.
4. What if you exceed ~1 000 concurrent games?
Firestore limits you on write throughput per document (1 write/s) and overall project writes (by quota). 1 000 concurrent games is still well within project-level limits, but if you grow beyond that:
A. Horizontal scaling inside Firestore
Each game already has its own state document ⇒ you naturally shard writes.
Use batched writes or transactions only when required to reduce per-write overhead.
Split heavy-update fields (e.g., progressMs) into a separate doc if you notice write hotspots.
B. Raise quotas
You can request higher daily write/read quotas in Firebase support; many apps run >50 k writes/s after approval.
C. Hybrid approach
If traffic explodes (tens of thousands of concurrent games):
Keep “cold” or infrequently changing data (player profiles, playlists) in Firestore.
Move hot, high-frequency state (e.g., play progress) to:
Redis (Elasticache) or
DynamoDB (single-digit-ms latency, 40 k+ writes/s per table).
You can bridge DynamoDB to Firestore with an EventBridge/Lambda to keep eventual consistency.
Consider socket-based fan-out (AWS API Gateway + WebSocket or Firebase Realtime DB) for near-instant pushes if Firestore latency (≈200 ms p95) becomes noticeable.
D. Observability
Set up Cloud Monitoring dashboards and alert at 70 % of write quota.
Stress-test with the Firebase emulator + locust/k6 to find your real limits before going live.
Double-check points
• The new security tasks use generic names (no official function/API names involved).
Verify Firestore TTL retention behaviour in your region (it can take ~24 h window to purge).
If you later containerise the backend on AWS, remember to replicate those CSP/secret-management settings in the load-balancer layer.
Let me know if you’d like the cleanup tasks (TTL or scheduler) added to game.md as well.
is firebase appropriate for a wen game?

Yes—Firebase can be an excellent backend for a modern web-based game, but its suitability depends on the game’s real-time demands, player counts, and how much server-side authority you need. Below is a concise decision matrix tailored to your “guess-the-song” multiplayer game and to faster-paced games for comparison.
1. Strengths of Firebase for Web Games
1. Plug-and-play Auth
Email, Google, Apple, anonymous sessions, custom JWTs.
Rules engine lets you gate resources per user/role.
Realtime Data Sync
Firestore and Realtime DB stream document/JSON updates straight to the browser—no self-managed WebSocket server.
Built-in offline cache = smoother mobile experience.
Serverless Logic
Cloud Functions (HTTP, pub/sub, Firestore triggers) run authoritative scoring or anti-cheat code without provisioning servers.
Edge-cached Hosting & CDN
Firebase Hosting serves your Vite SPA with HTTP/2 and automatic TLS.
Easily swap to CloudFront/S3 later if you move to AWS.
Security & Cost
Fine-grained rules enforce per-field access.
Pay-as-you-go; generous free tier for early testing.
2. Where Firebase Fits Well
Use-case match for your music-trivia game:
“Turn-based in seconds” cadence
One write per player per round, host state ~2-3 writes/s ⇒ well under quotas.
≤ 100 concurrent players per lobby; a few thousand lobbies total.
Trust-but-verify gameplay—Cloud Functions can validate every guess and compute scores.
Occasional, not frame-synchronous updates; 100–400 ms latency is fine.
Verdict: Firebase (Firestore + Functions) is a very solid fit.
3. When Firebase Starts to Hurt
1. High-frequency state (millisecond ticks, physics)
Firestore/RTDB latencies (p95≈200 ms) are too slow for 60 FPS action.
Heavy write hotspots
Max 1 write/sec per document; fast shooters often require 30–60 writes/sec.
Complex server-side matchmaking, lag compensation, or authoritative physics
You’ll want a dedicated multiplayer game server (Node, Go, or C++) behind raw WebSockets or UDP.
Mitigations
Offload high-tick data to Redis/DynamoDB or a custom WebSocket shard while keeping Firebase for auth, chat, leaderboards.
Use Cloud Run / ECS Fargate for a stateful server if real-time authority becomes critical.
4. Cost & Scaling Cheat-sheet
Action | Cost impact | Notes
------|-------------|------
Read 1 k docs | ~$0.06 | Batch reads where possible.
Write 1 k docs | ~$0.18 | Guess & score writes dominate.
1 GB storage | ~$0.026/mo | Store album art elsewhere (S3/Cloud Storage).
100 GB egress | Included in Blaze | Past that, add Cloud CDN.
1000 concurrent games ≈ 10 k writes/min is still well within Firestore daily quotas, but monitor and file quota-increase requests early.
5. Recommendations for Your Project
• Stick with Firestore for now; latency is acceptable for a “guess in 30 s” loop.
Keep each lobby’s rapidly changing fields (progressMs) in its own document to avoid “hot” docs.
Instrument Cloud Monitoring; alert at 70 % of write quota.
Plan an “escape hatch”: a thin Node/Express + Socket.io service containerised in AWS App Runner if you later decide to push real-time animations or need <50 ms latency.
Bottom line
For casual, social, and trivia-style web games—your music game included—Firebase offers an industry-standard, highly productive stack with minimal ops overhead. If you pivot to twitch-speed action, you can still keep Firebase for identity, persistence, and leaderboard features while introducing a dedicated real-time game server for the hot path.
lets remove ARIA and screen-reader requirement as we dont need it



All ARIA and screen-reader references have been removed, keyboard-navigation items polished, and the full security checklist has been reinstated under the Security section.
Let me know if you’d like any more tweaks!
how will 6th point be implemented in React? should some webhook/events be used between players?

Below is a practical blueprint for implementing Acceptance-Criterion #6 (“Real-time Sync”) in the React front-end. It uses the Firestore SDK’s real-time listeners as the event bus, so you don’t need additional web-hooks or peer-to-peer signalling.
1. Event Flow at a Glance
1. Player clicks a Guess button →
Client writes a new document to /games/{lobbyId}/guesses/ (or calls a callable Cloud Function).
Cloud Function onGuessCreated runs atomically:
checks correctness & duplicate guesses
sets isCorrect, winnerId, roundFinishedAt, etc.
increments scores in /scores/{playerId}
updates /games/{lobbyId}/state with roundWinnerId (and maybe disableGuessing: true).
Firestore instantly streams those mutations back to every connected browser (typically 80–150 ms).
React listeners receive the change and update UI; guessing buttons get disabled and the winner is highlighted—well under the 1 s requirement.
2. Key Firestore Documents / Fields
• /games/{id}/state
Apply to game.md
}
/games/{id}/guesses/{guessId} (created by client)
Apply to game.md
}
/games/{id}/scores/{playerId} (updated by CF).
3. React Implementation Snippets
A. Generic hook to observe game-state:
Apply to game.md
;
B. Consuming it inside the Game container:
Apply to game.md
;
C. Writing a guess (optimistic local UI optional):
Apply to game.md
;
No Firestore transactions are needed on the client—server-side Cloud Function resolves race conditions.
4. Cloud Function onGuessCreated (outline)
```ts
export const onGuessCreated = functions
.firestore
.document("games/{lobbyId}/guesses/{guessId}")
.onCreate(async (snap, ctx) => {
const guess = snap.data() as Guess;
const lobbyId = ctx.params.lobbyId;
// Guard: stop processing if another winner already exists
const stateRef = db.doc(games/${lobbyId}/state);
await db.runTransaction(async t => {
const stateSnap = await t.get(stateRef);
const state = stateSnap.data() as GameState;
if (state.roundWinnerId) return; // someone already won
const isCorrect = guess.guessedOwnerId === state.trackOwnerId;
const updates: any = {};
if (isCorrect) {
updates.roundWinnerId = guess.playerId;
updates.disableGuessing = true;
}
// Write back results atomically
t.update(snap.ref, { isCorrect });
t.set(
db.doc(games/${lobbyId}/scores/${guess.playerId}),
{ score: isCorrect ? 3 : -1 },
{ merge: true },
);
t.update(stateRef, updates);
});
});


export const onGuessCreated = functions
  .firestore
  .document("games/{lobbyId}/guesses/{guessId}")
  .onCreate(async (snap, ctx) => {
    const guess = snap.data() as Guess;
    const lobbyId = ctx.params.lobbyId;

    // Guard: stop processing if another winner already exists
    const stateRef = db.doc(`games/${lobbyId}/state`);
    await db.runTransaction(async t => {
      const stateSnap = await t.get(stateRef);
      const state = stateSnap.data() as GameState;

      if (state.roundWinnerId) return; // someone already won

      const isCorrect = guess.guessedOwnerId === state.trackOwnerId;
      const updates: any = {};

      if (isCorrect) {
        updates.roundWinnerId = guess.playerId;
        updates.disableGuessing = true;
      }

      // Write back results atomically
      t.update(snap.ref, { isCorrect });
      t.set(
        db.doc(`games/${lobbyId}/scores/${guess.playerId}`),
        { score: isCorrect ? 3 : -1 },
        { merge: true },
      );
      t.update(stateRef, updates);
    });
  });