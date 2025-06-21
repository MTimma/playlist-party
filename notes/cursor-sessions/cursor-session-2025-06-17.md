# Planning sprints and workflows for game features
_Exported on 17/06/2025 at 9:50:30 EEST from Cursor (1.0.0)_

---

**User**


I read recommendations about such workflow, where we plan everything before writing any code:

"Well, there's a lot of planning and architecture before there's any building. Several pages of user flows and notes. Then I break it down into milestones and sprints. For each sprint I break it down into steps. Then we go through an iterative process of ensuring the architecture is well defined and add any cautionary advise.
Determine which stack, libraries, design patterns we're going to use and develop schemas, etc. I find using a design like DDD to be super helpful. Then when I'm satisfied and 03 can't find meaningful improvements for the MVP, I have it build out step by steps for each sprint and todos for each milestone. Then I move the relevant docs to cursor rules to be called for every new chat. Make sure the docs reference each other. Each new sprint is a new chat. Just call up the doc for the sprint you're on and walk it through it.

This is the way. I spent days preparing linked markdown documentation. I also make 500 lines limit to optimize context. Great results!

You can split the docs and reference each other. It only calls them up if needed for reference. I also add a few notes about what the other files contain with my references.

Yes, documents in a folder and linked through an ÍNDEX.md file so agent consumes only What is related to task and not waste context and all docs Max 500 lines. If section is larger, split.

I created a linked matrix and file architecture with an archived sibling folder for observational references just in case. Each Claude session is it's own spring and it has a delivery template. Then we recursively go back and more granularly and architecturally revisit our code, prune etc


Yes, documents in a folder and linked through an INDEX.md file so agent consumes only What is related to task and not waste context and all docs Max 500 lines. If section is larger, split.

I created a linked matrix and file architecture with an archived sibling folder for observational references just in case. Each Claude session is it's own spring and it has a delivery template. Then we recursively go back and more granularly and architecturally revisit our code, prune etc

How that works? I Will look into that.
Thanks for the reference"


 I would like to implement following features in my project. Do not write any code. Lets plan out sprints and workflows for each feature. Lets start with first one.

Create some initial plan and I will add to it.

1. Create game lobby and invite anonymous players - friends
2. Add songs to a shared playlist
3. Guess which player added each song
4. Real-time score tracking
5. Spotify integration for music playback (not necessary as written, main necessity is to see which song is currently played from playlist by user)



---

**Cursor**

Feature #1 — “Create game lobby and invite anonymous players”

Below is an initial, high-level delivery plan.  Think of it as a living outline: you can add or re-sequence work as the vision evolves.  Nothing here is code; it is the structure of the work.

────────────────────────────────────
A. Architecture & Tech Decisions
────────────────────────────────────
1. Domain‐Driven “feature slice”  
   • Bounded Context: Lobby  
   • Core Aggregates/Entities  
     - GameLobby (root)  
     - Player (value object until registration)  
     - InviteToken (value object, short-lived)  

2. Persistence & Real-time transports  
   • Firebase Realtime DB for initial MVP (easy websockets, generous free tier)  
   • Firestore rules for auth/ACL; anonymous Firebase Auth for guests  
   • Use Firestore/Realtime “onWrite” functions later for side effects (scoreboard)  

3. Front-end patterns  
   • React + Context / Zustand for lobby state  
   • React-Router route “/lobby/:lobbyId” (host & guests)  
   • URL sharing instead of e-mail (simpler, no mail service early)  

4. Security & Privacy  
   • InviteToken = random 22-char Base62 stored only in DB path (no guessable IDs)  
   • Rules: only players listed in `/lobbies/{id}/players` can read/write that lobby  
   • Rate-limit: max 10 join attempts / IP / minute with Cloud Functions if abused  
   • No secret keys in client; all env via VITE_… variables as already practiced  

────────────────────────────────────
B. Milestones & Sprints (MVP path)
────────────────────────────────────
Milestone 0 – “Foundation” (½ d)  
  - Verify Firebase project + anonymous auth enabled  
  - Set up CI lint/test & .env.example in repo

Sprint 1 – “Domain & API skeleton” (2 d)  
  1. Write Lobby context model (TypeScript interfaces only)  
  2. Implement LobbyRepository (create/read/update, unit-tested)  
  3. Draft Firebase security rules (fail-first tests with emulator)  
  4. Storybook stub components: LobbyCreate, LobbyWaitingRoom, PlayerList  

Sprint 2 – “Happy-path Lobby UX” (3 d)  
  1. Host flow  
     - “Create lobby” button → POST to repository → redirect /lobby/:id  
     - Display shareable link (copy + QR)  
  2. Guest flow  
     - Landing name prompt → join lobby with token  
     - Real-time player list (tailwind avatars)  
  3. Smoke-test on two browsers / mobile

Sprint 3 – “Hardening & Edge Cases” (2 d)  
  1. Reconnect / disconnect detection (presence)  
  2. Handle duplicate names, max player cap (configurable)  
  3. Loading / error states; toast notifications  
  4. Instrument basic analytics (join time, dropouts)

Milestone 1 – “Production-ready Lobby”  
  - All checklist items green; host can reliably gather friends.

────────────────────────────────────
C. Workflow for Each Sprint
────────────────────────────────────
1. Backlog grooming  
   • Convert outline to user stories w/ Definition of Done & acceptance tests.  
2. Kick-off  
   • Re-state sprint goal; surface risks.  
3. Daily iteration loop  
   • Code → PR → automated test & lint → peer review → merge to `dev`.  
4. End-of-day bot  
   • Post Firebase emulator test report + Lighthouse perf snapshot.  
5. Sprint review & retro  
   • Demo with 3 remote browsers; note latency & auth hiccups.

────────────────────────────────────
D. Cautionary Advice
────────────────────────────────────
• Avoid coupling “players” to auth early; anonymous UID may change on sign-out.  
• Keep LobbyRepository isolated: switching to Postgres + WebSocket later should only require adapter swap.  
• Index Firebase paths `/lobbies/*/players` on `.joinedAt` for ordering (scoreboard later).  
• Protect against “lobby enumeration” by using cryptographically random IDs, not push-IDs.  

────────────────────────────────────
E. Deliverables for Sprint 1
────────────────────────────────────
- `/docs/lobby/DOMAIN_MODEL.md` (<500 lines)  
- `/docs/lobby/SECURITY_RULES.md`  
- Lobby interfaces & repository (100% unit test coverage)  
- Security rules tested via emulator CI job  
- Storybook stubs with a11y pass

────────────────────────────────────
Next Step
────────────────────────────────────
If this structure looks good, we flesh out the Sprint 1 backlog items (stories, acceptance criteria, test outline).  Let me know what you’d like to adjust or dive into!

---

**User**

Plesae check these 3 items:
1. how do we tie lobby id to spotify user?
2. React + Context / Zustand for lobby state 
what is this and why is this needed

3. @Web Check Spotify API current documentation. Would this be possible with Spotify API:
* anonymous guests Add songs to a shared playlist
* see which song is currently played by the authorized user from their shared playlist
* Guess which player added each song


---

**Cursor**

Below are concise answers to the three follow-up questions, with pointers to the current Spotify Web-API docs.

────────────────────────────────────
1 How do we tie a lobby ID to a Spotify user?
────────────────────────────────────
• During “Create lobby”, the host completes a Spotify OAuth flow (`user-read-private`, `playlist-modify-public`, `playlist-modify-private`, `user-read-playback-state` scopes).  
• After Spotify redirects back, we receive the host’s `spotifyUserId` and long-lived refresh token.  
• We write one Firebase document:

```
/lobbies/{lobbyId}
  ├─ hostFirebaseUid          // UID from Firebase Auth
  ├─ hostSpotifyUserId        // e.g. "wizzbang42"
  ├─ playlistId               // created right now or later
  ├─ createdAt                // serverTimestamp
  └─ status                   // "waiting" | "in_progress" | "finished"
```

Because the document contains both `lobbyId` (public, shared in the URL) and `hostSpotifyUserId` (private), we can:
• call Spotify on behalf of the host (server-side Cloud Function that exchanges a refresh token → access token)  
• display “▶ Now playing” info to all guests by broadcasting via Realtime DB.  

Guests never touch Spotify directly; they remain anonymous (Firebase anonymous auth).

────────────────────────────────────
2 “React + Context / Zustand for lobby state” — what & why?
────────────────────────────────────
• React Context = built-in mechanism to pass data deeply without prop-drilling. Great for *who* the current lobby is and whether the user is host/guest.  
• Zustand = a tiny Flux-like state-management library. Why add it?  
  – It gives a global store with selector hooks (`useLobbyStore(state ⇒ state.players)`) without Context provider nesting.  
  – Re-renders are scoped to selected slices → better perf than one giant Context.  
  – Its API is dead simple (no reducers/boilerplate), so we keep cognitive load low.  

Typical pattern:
```ts
// src/contexts/LobbyContext.tsx
export const LobbyContext = createContext<LobbyMeta | null>(null);

// src/store/lobbyStore.ts
export const useLobbyStore = create<LobbyState>(set => ({
  players: {},
  addPlayer: p => set(s => ({ players: { ...s.players, [p.id]: p } })),
}));
```
UI components read immutable lobby metadata from Context and live player list / scores from Zustand.  
This split keeps concerns clear and prevents accidental re-creates of WebSocket/Firebase listeners.

────────────────────────────────────
3 Feasibility with current Spotify API
────────────────────────────────────
a) “Anonymous guests add songs to a shared playlist”  
 • Playlist endpoints require *someone’s* OAuth token with a `playlist-modify` scope.  
 • Therefore, truly anonymous guests can’t call Spotify. Two common work-arounds:  
   1. Guests nominate tracks by pasting URLs/URIs → server adds them via the **host’s** token.  
   2. Ask each guest to perform a lightweight PKCE login (then they’re no longer anonymous).  
 Conclusion: *Yes*, but only by proxy through the authenticated host (or by asking guests to authenticate).

b) “See which song is currently played by the authorized user”  
 • Endpoint `GET /v1/me/player/currently-playing` (`user-read-playback-state` scope) returns the current track on the host’s device.  
 • We can poll it every few seconds or use the Web Playback SDK events if playback is inside the browser.  
 • Broadcast the result to guests over Firebase.  
 Conclusion: *Yes*, fully supported.  
 Docs: [Get Currently Playing Track](https://developer.spotify.com/documentation/web-api/reference/get-the-users-currently-playing-track)

c) “Guess which player added each song”  
 • `Get Playlist Items` returns an `added_by` field with the Spotify user who added the track.  
 • For a *collaborative playlist* that field is populated automatically.  
 • If only the host token adds tracks on behalf of guests, `added_by` will always be the host, so we must store our own metadata:  
```
/lobbies/{id}/playlistMeta/{trackUri}
  └─ suggestedBy : playerId
```  
 Conclusion:  
  – Automatic identification works **only** if each player is authenticated and adds the track themselves.  
  – Otherwise we must persist a custom mapping.

Reference docs: [Spotify Playlists – Add Items / Get Playlist Items](https://developer.spotify.com/documentation/web-api/concepts/playlists)

────────────────────────────────────
TL;DR
────────────────────────────────────
1. Save the host’s Spotify user ID in the lobby document; use their refresh token to act on Spotify.  
2. React Context delivers immutable lobby meta; Zustand holds fast-changing real-time state.  
3. All three capabilities are doable, but adding & attribution for *anonymous* guests requires the server to mediate (or to ask them to log in).

```plaintext
/lobbies/{lobbyId}
  ├─ hostFirebaseUid          // UID from Firebase Auth
  ├─ hostSpotifyUserId        // e.g. "wizzbang42"
  ├─ playlistId               // created right now or later
  ├─ createdAt                // serverTimestamp
  └─ status                   // "waiting" | "in_progress" | "finished"
```

```typescript
// src/contexts/LobbyContext.tsx
export const LobbyContext = createContext<LobbyMeta | null>(null);

// src/store/lobbyStore.ts
export const useLobbyStore = create<LobbyState>(set => ({
  players: {},
  addPlayer: p => set(s => ({ players: { ...s.players, [p.id]: p } })),
}));
```

```plaintext
/lobbies/{id}/playlistMeta/{trackUri}
  └─ suggestedBy : playerId
```

---

**User**

1.Guests nominate tracks by pasting URLs/URIs → server adds them via the host’s token.
no, the game should have search for spotify songs

---

**Cursor**

Absolutely—guests can stay anonymous and still use an in-app “Search Spotify” dialog.  
Below is a practical flow that satisfies both Spotify’s auth model and our “no-login-for-guests” rule.

────────────────────────────────────
A. How anonymous search works
────────────────────────────────────
1  Backend obtains an “app-only” token  
   • Use the Client-Credentials flow (no user context) ⇒ access token with **no user scopes**.  
   • This token is perfect for read-only endpoints like `GET /v1/search`.  
   • Cache it in memory until it expires (60 min) to reduce traffic to Spotify’s auth server.

2  Guest types a query  
   • Front-end `debounce(400 ms)` → `POST /api/spotify/search?q=…&type=track`.  
   • Cloud Function / Express route forwards the call with the cached app token.  
   • Response includes track name, artist, album art, URI, duration, preview\_url (if any).

3  Guest picks a track  
   • Front-end emits `addTrackProposal` to Firebase at  
     `/lobbies/{id}/proposals/{trackUri}`  
     ```
     {
       proposedBy : playerId,
       track      : { uri, name, artists, duration_ms, preview_url }
     }
     ```  
   • UI immediately shows it as “pending”.

4  Host-token bot finalises the add  
   • Cloud Function `onCreate` listener on `/proposals/*`  
     – Reads the lobby’s stored `hostRefreshToken`  
     – Exchanges → host access token (scopes `playlist-modify-private|public`)  
     – `POST /v1/playlists/{playlistId}/tracks` body `{ uris:[trackUri] }`  
     – On success:  
       – Move document to `/playlistMeta/{trackUri}` with `addedBy : playerId`  
       – Delete from proposals / mark as accepted.  
     – On failure: write error field → front-end displays toast.  

Guests never touch Spotify credentials; the only privileged calls happen server-side.

────────────────────────────────────
B. UX & real-time considerations
────────────────────────────────────
• Autocomplete / preview  
  – Limit results to 10 tracks, 3 requests / sec per guest.  
  – Display 30-sec `preview_url` if available; otherwise grey out the play button (complies with Spotify TOS on previews).

• Duplicate prevention  
  – Server rejects a proposal if the track already exists in `/playlistMeta`.

• Abuse & rate limiting  
  – Search endpoint: 30 req / sec / client-id (§Spotify rate limits).  
  – Cloud Function should apply per-IP quota (> userRules: security best practice).

────────────────────────────────────
C. Sprint-level impact
────────────────────────────────────
• Add tasks to Sprint 2  
  2.1 Build `SearchDialog` component (Typeahead + list)  
  2.2 Implement `/api/spotify/search` wrapper + caching logic  
  2.3 Write Firebase rule: only authenticated (even if anonymous) users may write to `/proposals/{trackUri}`  

• Add tasks to Sprint 3  
  3.5 Cloud Function `onProposalCreated` (add to playlist, move metadata)  
  3.6 End-to-end test: two browsers, guest adds song, host playlist updates within 2 s.

────────────────────────────────────
D. Compliance checkpoints
────────────────────────────────────
✓ Client-Credentials token is stored server-side only.  
✓ All playlist mutations use the host’s user token (required by Spotify’s policy).  
✓ We display Spotify attribution and album art exactly as returned (§ Developer Terms).  
✓ No secrets leak to the browser; all env vars remain in server runtime.

This approach gives guests the full “search & pick” experience while keeping them anonymous and staying within Spotify’s current API constraints.

```plaintext
     {
       proposedBy : playerId,
       track      : { uri, name, artists, duration_ms, preview_url }
     }
```

---

**User**

what would be better approach?

In terms of simplicity and less possible bugs

1. Only host spotify access is used for update playlist

2. Each player logs in from their spotify account and adds to shared playlist 

---

**Cursor**

Below is a side-by-side comparison focused strictly on “overall simplicity” and “bug-surface area”.  Pick whichever flavour of complexity you prefer—there isn’t a single winner for every team.

────────────────────────────────────
OPTION A “One-token model”
Only the host authorises Spotify; everyone else stays anonymous.
────────────────────────────────────
What becomes simpler
• On-boarding Guests never see an OAuth screen → zero drop-off.  
• Token storage Exactly one refresh-token in the DB; easy to rotate or revoke.  
• Playlist ownership Playlist is always owned by the host, so ACL issues disappear.

What grows in complexity / bug risk
• Extra backend paths You must implement the “proposal → approve → add” workflow and keep it race-free.  
• False attribution Spotify’s `added_by` will always be the host.  You have to maintain custom metadata and keep it in sync if a track is later removed or reordered.  
• Rate limits All playlist writes hit a single user-token, so rapid, parallel additions can 429.

Net simplicity score
• Fewer moving parts in auth, **more** moving parts in data-flow.  
• Best when your priority is friction-free guest entry and you’re comfortable writing a small dispatcher Cloud Function.

────────────────────────────────────
OPTION B “Everyone logs in”
Each player completes PKCE OAuth and writes to the playlist directly.
────────────────────────────────────
What becomes simpler
• Business logic No proposal queue, no custom `added_by` mapping, no server-side playlist writes.  The front-end calls `POST /playlists/{id}/tracks` and you’re done.  
• Real-time accuracy Spotify already knows who added what; any later re-ordering or removal keeps attribution intact.  
• Scalability Writes are spread across many user tokens, so hitting rate limits is unlikely.

What grows in complexity / bug risk
• User experience Every guest must have (or create) a Spotify account and approve scopes—expect some churn.  
• Multi-token maintenance Tokens can expire or be revoked one by one; you need robust refresh handling for N players.  
• Edge permissions Guests must follow the playlist and have `playlist-modify-*` scope; if they skip a step the add will fail.

Net simplicity score
• More moving parts in auth, **fewer** in server logic.  
• Best when your players are comfortable logging into Spotify and you want to off-load as much as possible to Spotify’s own ACLs.

────────────────────────────────────
Decision heuristics
────────────────────────────────────
Choose A (host-only token) if:
• You want a “Jackbox-style” experience where anyone can join in two clicks.  
• Your team is happy to write a small mediation layer and accept minor attribution bookkeeping.

Choose B (everyone logs in) if:
• Your players are already Spotify users and don’t mind OAuth.  
• You prefer to remove custom backend logic and lean on Spotify to track who did what.

Either path is viable and industry-compliant; pick the one that places complexity where your team is stronger (UX vs. backend plumbing).

---

**User**

lets choose A

---

**Cursor**

Great—Approach A (“host-only Spotify token, guests remain anonymous”) is locked in.  
Below is the feature-2 delivery plan that sits on top of the lobby work we already outlined.

════════════════════════════════ Feature #2 ― Add Songs to Shared Playlist (Host-Only Token) ════════════════════════════════

A. Core Architecture Decisions
1. Search authority  
   • Server holds a *client-credentials* token (read-only) for `GET /v1/search`.  
   • Token cached in memory (≈60 min) and rotated automatically.

2. Write authority  
   • Host granted `playlist-modify` scopes during lobby creation → refresh token stored server-side (env-encrypted).  
   • Cloud Function exchanges refresh→access token whenever a guest proposal appears.

3. Data shapes  
```
/lobbies/{lobbyId}
  ├─ playlistId              // created when first track accepted
  └─ …

/lobbies/{lobbyId}/proposals/{trackUri}
  └─ { proposedBy, trackMeta, createdAt }

/lobbies/{lobbyId}/playlistMeta/{trackUri}
  └─ { addedBy, trackMeta, addedAt, snapshotId }
```

4. Security rules (Firebase)  
   • Anonymous users may *read* playlistMeta & proposals; *write* only their own proposal doc.  
   • Cloud Function runs with admin privileges; no secrets reach the client.

5. Failure / edge paths  
   • Duplicate track or 429 from Spotify ⇒ mark proposal → status:"rejected", reason.  
   • Host token revoked ⇒ lobby goes into “maintenance” banner and prompts host to re-authenticate.

B. Milestones & Sprints (adds on to previous timeline)

Milestone 2 – “Playlist Collaboration MVP”

Sprint 4 (3 d) — Guest Search & Proposal  
  4.1 SearchDialog component with debounce & preview audio  
  4.2 `/api/spotify/search` route + token-cache middleware  
  4.3 Firebase rules: guests can write proposals ≤ 5 active each  
  4.4 UX polish: duplicate warning, proposal list with avatars

Sprint 5 (2 d) — Proposal Processing & Playlist Sync  
  5.1 Cloud Function `onProposalCreated` → add track via host token  
  5.2 Create playlist on first accept; store `playlistId` & initial snapshotId  
  5.3 Move proposal → playlistMeta, broadcast toast “Track added by X”  
  5.4 E2E test: two browsers + emulator, latency < 2 s

Sprint 6 (2 d) — Hardening & Rate-Limit Guards  
  6.1 Exponential back-off + retry queue for transient Spotify 5xx  
  6.2 Batch additions if ≥ 5 pending proposals  
  6.3 Alerting: Slack webhook if > 3 failures in 5 min  
  6.4 Accessibility pass for SearchDialog (keyboard nav, screen reader)

Milestone 2 exit criteria  
  • Guest can search > select > see track appear in < 3 s.  
  • No secrets exposed in network tab.  
  • Manual chaos test: drop network, duplicate proposals, token expiry—all handled gracefully.

C. Workflow Add-ons for these sprints
• New CI job: Jest + Firebase-emulator tests for security rules on `/proposals`.  
• Mock-Spotify server for local dev to avoid rate limits.  
• Add `docs/playlist/SEARCH_API.md` and `docs/playlist/PROPOSAL_FLOW.md` (≤500 lines each, cross-linked from INDEX.md).

D. Cautionary Advice
• Remember that `preview_url` is not guaranteed; the UI must tolerate nulls.  
• Store `snapshotId` returned by each playlist mutation—handy for later rollbacks.  
• Clean up orphaned proposals on lobby end to avoid dangling writes against an expired refresh token.

E. Next Step
Convert Sprint 4 items into granular user stories with acceptance criteria and start the ticketing board.  
When you’re ready, we’ll draft those stories (no code, just wording) so the team can pick them up.

```plaintext
/lobbies/{lobbyId}
  ├─ playlistId              // created when first track accepted
  └─ …

/lobbies/{lobbyId}/proposals/{trackUri}
  └─ { proposedBy, trackMeta, createdAt }

/lobbies/{lobbyId}/playlistMeta/{trackUri}
  └─ { addedBy, trackMeta, addedAt, snapshotId }
```

---

**User**

lets flesh out the sprint 1 items with what you have written so far

---

**Cursor**

I'll break down Sprint 1 into detailed user stories, incorporating our previous decisions about the host-only Spotify token model and Firebase structure.

════════════════════════════════ Sprint 1 ― Domain & API Skeleton ════════════════════════════════

Story 1.1: Define Core Domain Models
```
As a developer
I want clear TypeScript interfaces for our domain entities
So that we have a single source of truth for data shapes

Acceptance Criteria:
✓ Lobby interface includes:
  - id: string
  - hostFirebaseUid: string
  - hostSpotifyUserId: string
  - playlistId?: string
  - status: 'waiting' | 'in_progress' | 'finished'
  - createdAt: Timestamp
  - maxPlayers: number
  - currentRound?: number

✓ Player interface includes:
  - id: string
  - name: string
  - isHost: boolean
  - joinedAt: Timestamp
  - score: number
  - avatarUrl?: string

✓ Track interface includes:
  - uri: string
  - name: string
  - artists: Array<{name: string, id: string}>
  - duration_ms: number
  - preview_url?: string
  - album: {
      name: string
      images: Array<{url: string, height: number, width: number}>
    }

Definition of Done:
- Interfaces in `/src/types/lobby.ts`
- JSDoc comments for each field
- Unit tests verifying type constraints
```

Story 1.2: Implement LobbyRepository
```
As a developer
I want a repository layer for lobby operations
So that we can abstract Firebase implementation details

Acceptance Criteria:
✓ Repository methods:
  - createLobby(hostUid: string, hostSpotifyId: string): Promise<Lobby>
  - getLobby(id: string): Promise<Lobby | null>
  - updateLobbyStatus(id: string, status: LobbyStatus): Promise<void>
  - addPlayer(lobbyId: string, player: Player): Promise<void>
  - removePlayer(lobbyId: string, playerId: string): Promise<void>

✓ Error handling:
  - LobbyNotFoundError
  - DuplicatePlayerError
  - InvalidStateError

✓ Firebase integration:
  - Uses admin SDK in Cloud Functions
  - Uses client SDK in browser
  - Proper error mapping

Definition of Done:
- Repository in `/src/repositories/LobbyRepository.ts`
- 100% unit test coverage
- Integration tests with Firebase emulator
```

Story 1.3: Firebase Security Rules
```
As a security engineer
I want strict Firebase security rules
So that data access is properly controlled

Acceptance Criteria:
✓ Rules for /lobbies/{lobbyId}:
  - Read: any authenticated user
  - Write: only if user is in players list
  - Create: any authenticated user
  - Delete: only host

✓ Rules for /lobbies/{lobbyId}/players/{playerId}:
  - Read: any authenticated user
  - Write: only if playerId matches auth.uid
  - Create: any authenticated user
  - Delete: only host or self

✓ Rules for /lobbies/{lobbyId}/proposals/{trackUri}:
  - Read: any authenticated user in players list
  - Write: only if user is in players list
  - Create: any authenticated user in players list
  - Delete: only host

Definition of Done:
- Rules in `firestore.rules`
- Rules tested in emulator
- CI job verifies rules
```

Story 1.4: Storybook Components
```
As a UI developer
I want basic lobby components in Storybook
So that we can develop UI in isolation

Acceptance Criteria:
✓ LobbyCreate component:
  - "Create Lobby" button
  - Spotify auth flow integration
  - Loading states
  - Error handling

✓ LobbyWaitingRoom component:
  - Player list with avatars
  - Share link display
  - Start game button (host only)
  - Player join/leave animations

✓ PlayerList component:
  - Real-time updates
  - Player cards with avatars
  - Score display
  - Host indicator

Definition of Done:
- Components in `/src/components/lobby/`
- Stories in `/src/stories/lobby/`
- Accessibility pass
- Responsive design verified
```

Technical Dependencies:
1. Firebase project setup
2. Spotify Developer account
3. Environment variables:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_REDIRECT_URI=...
```

Testing Strategy:
- Unit tests: Jest + React Testing Library
- Integration: Firebase emulator
- E2E: Cypress (basic smoke tests)
- Performance: Lighthouse CI

Documentation Deliverables:
- `/docs/lobby/DOMAIN_MODEL.md` (≤500 lines)
- `/docs/lobby/SECURITY_RULES.md` (≤500 lines)
- `/docs/lobby/API.md` (≤500 lines)

Would you like me to expand on any of these stories or add more detail to a particular aspect?

```plaintext
As a developer
I want clear TypeScript interfaces for our domain entities
So that we have a single source of truth for data shapes

Acceptance Criteria:
✓ Lobby interface includes:
  - id: string
  - hostFirebaseUid: string
  - hostSpotifyUserId: string
  - playlistId?: string
  - status: 'waiting' | 'in_progress' | 'finished'
  - createdAt: Timestamp
  - maxPlayers: number
  - currentRound?: number

✓ Player interface includes:
  - id: string
  - name: string
  - isHost: boolean
  - joinedAt: Timestamp
  - score: number
  - avatarUrl?: string

✓ Track interface includes:
  - uri: string
  - name: string
  - artists: Array<{name: string, id: string}>
  - duration_ms: number
  - preview_url?: string
  - album: {
      name: string
      images: Array<{url: string, height: number, width: number}>
    }

Definition of Done:
- Interfaces in `/src/types/lobby.ts`
- JSDoc comments for each field
- Unit tests verifying type constraints
```

```plaintext
As a developer
I want a repository layer for lobby operations
So that we can abstract Firebase implementation details

Acceptance Criteria:
✓ Repository methods:
  - createLobby(hostUid: string, hostSpotifyId: string): Promise<Lobby>
  - getLobby(id: string): Promise<Lobby | null>
  - updateLobbyStatus(id: string, status: LobbyStatus): Promise<void>
  - addPlayer(lobbyId: string, player: Player): Promise<void>
  - removePlayer(lobbyId: string, playerId: string): Promise<void>

✓ Error handling:
  - LobbyNotFoundError
  - DuplicatePlayerError
  - InvalidStateError

✓ Firebase integration:
  - Uses admin SDK in Cloud Functions
  - Uses client SDK in browser
  - Proper error mapping

Definition of Done:
- Repository in `/src/repositories/LobbyRepository.ts`
- 100% unit test coverage
- Integration tests with Firebase emulator
```

```plaintext
As a security engineer
I want strict Firebase security rules
So that data access is properly controlled

Acceptance Criteria:
✓ Rules for /lobbies/{lobbyId}:
  - Read: any authenticated user
  - Write: only if user is in players list
  - Create: any authenticated user
  - Delete: only host

✓ Rules for /lobbies/{lobbyId}/players/{playerId}:
  - Read: any authenticated user
  - Write: only if playerId matches auth.uid
  - Create: any authenticated user
  - Delete: only host or self

✓ Rules for /lobbies/{lobbyId}/proposals/{trackUri}:
  - Read: any authenticated user in players list
  - Write: only if user is in players list
  - Create: any authenticated user in players list
  - Delete: only host

Definition of Done:
- Rules in `firestore.rules`
- Rules tested in emulator
- CI job verifies rules
```

```plaintext
As a UI developer
I want basic lobby components in Storybook
So that we can develop UI in isolation

Acceptance Criteria:
✓ LobbyCreate component:
  - "Create Lobby" button
  - Spotify auth flow integration
  - Loading states
  - Error handling

✓ LobbyWaitingRoom component:
  - Player list with avatars
  - Share link display
  - Start game button (host only)
  - Player join/leave animations

✓ PlayerList component:
  - Real-time updates
  - Player cards with avatars
  - Score display
  - Host indicator

Definition of Done:
- Components in `/src/components/lobby/`
- Stories in `/src/stories/lobby/`
- Accessibility pass
- Responsive design verified
```

```plaintext
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_SPOTIFY_CLIENT_ID=...
VITE_SPOTIFY_REDIRECT_URI=...
```

---

**User**

what is Storybook and why use it?
What is Jest and why use it?
what is Lighthouse CI and why use it?

---

**Cursor**

Let me break down each tool and explain their purposes and benefits:

1. Storybook
```
What: A development environment tool for UI components
Why use it:
• Isolated Development
  - Build components in isolation
  - No need to navigate through your app to test a specific component
  - Faster development cycle

• Visual Testing
  - See all component states at once
  - Test different props combinations
  - Catch visual regressions early

• Documentation
  - Auto-generates component documentation
  - Shows props, usage examples
  - Serves as a living style guide

• Team Collaboration
  - Designers can review components
  - Developers can share component library
  - QA can test component variations

Example workflow:
1. Create Button component
2. Add stories for different states:
   - Default
   - Hover
   - Disabled
   - Loading
3. Test all states without running the full app
```

2. Jest
```
What: A JavaScript testing framework
Why use it:
• Unit Testing
  - Test individual functions
  - Mock dependencies
  - Verify business logic

• Snapshot Testing
  - Capture component output
  - Detect unexpected changes
  - Great for UI components

• Code Coverage
  - See which code is tested
  - Identify untested paths
  - Maintain quality

Example test:
```typescript
describe('LobbyRepository', () => {
  it('should create a new lobby', async () => {
    const repo = new LobbyRepository();
    const lobby = await repo.createLobby({
      hostId: 'user123',
      maxPlayers: 4
    });
    
    expect(lobby.id).toBeDefined();
    expect(lobby.status).toBe('waiting');
    expect(lobby.players).toHaveLength(1);
  });
});
```

3. Lighthouse CI
```
What: Automated performance, accessibility, and best practices testing
Why use it:
• Performance Monitoring
  - Page load speed
  - Time to interactive
  - Resource optimization

• Accessibility (a11y)
  - Screen reader compatibility
  - Color contrast
  - Keyboard navigation

• Best Practices
  - Security headers
  - HTTPS usage
  - Image optimization

• CI Integration
  - Fail builds on regressions
  - Track metrics over time
  - Team accountability

Example metrics tracked:
• Performance Score (0-100)
• First Contentful Paint
• Time to Interactive
• Accessibility Score
• Best Practices Score
```

For our music game project, here's how they work together:

```
Development Flow:
1. Build component in Storybook
   - Test all states
   - Verify accessibility
   - Get design feedback

2. Write Jest tests
   - Unit test business logic
   - Test component behavior
   - Ensure reliability

3. Lighthouse CI in pipeline
   - Catch performance issues
   - Verify accessibility
   - Maintain quality

Example CI Pipeline:
```yaml
stages:
  - test
  - build
  - lighthouse

test:
  script:
    - npm run test        # Jest tests
    - npm run test:coverage

build:
  script:
    - npm run build
    - npm run storybook:build

lighthouse:
  script:
    - npm run lighthouse  # Performance checks
    - npm run a11y        # Accessibility checks
```

Benefits for our project:
1. Faster Development
   - Build UI components independently
   - Test business logic in isolation
   - Catch issues early

2. Better Quality
   - Automated testing
   - Performance monitoring
   - Accessibility compliance

3. Team Efficiency
   - Shared component library
   - Automated quality checks
   - Clear documentation

4. User Experience
   - Faster loading times
   - Better accessibility
   - Consistent UI

Would you like me to expand on any of these tools or show more specific examples for our music game project?

```plaintext
What: A development environment tool for UI components
Why use it:
• Isolated Development
  - Build components in isolation
  - No need to navigate through your app to test a specific component
  - Faster development cycle

• Visual Testing
  - See all component states at once
  - Test different props combinations
  - Catch visual regressions early

• Documentation
  - Auto-generates component documentation
  - Shows props, usage examples
  - Serves as a living style guide

• Team Collaboration
  - Designers can review components
  - Developers can share component library
  - QA can test component variations

Example workflow:
1. Create Button component
2. Add stories for different states:
   - Default
   - Hover
   - Disabled
   - Loading
3. Test all states without running the full app
```

```plaintext
What: A JavaScript testing framework
Why use it:
• Unit Testing
  - Test individual functions
  - Mock dependencies
  - Verify business logic

• Snapshot Testing
  - Capture component output
  - Detect unexpected changes
  - Great for UI components

• Code Coverage
  - See which code is tested
  - Identify untested paths
  - Maintain quality

Example test:
```typescript
describe('LobbyRepository', () => {
  it('should create a new lobby', async () => {
    const repo = new LobbyRepository();
    const lobby = await repo.createLobby({
      hostId: 'user123',
      maxPlayers: 4
    });
    
    expect(lobby.id).toBeDefined();
    expect(lobby.status).toBe('waiting');
    expect(lobby.players).toHaveLength(1);
  });
});
```

3. Lighthouse CI
```

```plaintext

For our music game project, here's how they work together:

```

```yaml
stages:
  - test
  - build
  - lighthouse

test:
  script:
    - npm run test        # Jest tests
    - npm run test:coverage

build:
  script:
    - npm run build
    - npm run storybook:build

lighthouse:
  script:
    - npm run lighthouse  # Performance checks
    - npm run a11y        # Accessibility checks
```

---

**User**

Should we use these tools for such a small project? 

---

**Cursor**

Let me break down the cost-benefit analysis for a small project like our music game:

```
PROS of Using These Tools
1. Storybook
   ✓ Great for:
   - Complex UI components (like our SearchDialog)
   - Team collaboration
   - Component documentation
   
   ✗ Overkill for:
   - Simple, one-off components
   - Solo developer
   - Tight deadlines

2. Jest
   ✓ Essential for:
   - Critical business logic (lobby management)
   - Firebase interactions
   - Spotify API integration
   
   ✗ Can skip:
   - Simple UI components
   - Static pages
   - Prototype phase

3. Lighthouse CI
   ✓ Valuable for:
   - Production deployment
   - Performance critical features
   
   ✗ Unnecessary for:
   - MVP phase
   - Internal tools
   - Learning projects
```

For our specific project, here's my recommendation:

```
MINIMAL VIABLE SETUP
1. Keep Jest (but start small)
   - Test critical paths only:
     • Lobby creation/joining
     • Spotify token handling
     • Firebase security rules
   - Skip testing:
     • Simple UI components
     • Static pages
     • Helper functions

2. Skip Storybook initially
   - Build components directly in the app
   - Add it later if:
     • UI becomes complex
     • Team grows
     • Need component documentation

3. Skip Lighthouse CI initially
   - Use browser dev tools for performance
   - Add it when:
     • Going to production
     • Performance becomes an issue
     • Team needs automated checks
```

Revised Sprint 1 Plan:
```
Sprint 1 – "Domain & API skeleton" (2 d)  
1. Write Lobby context model (TypeScript interfaces only)  
2. Implement LobbyRepository (create/read/update, unit-tested)  
3. Draft Firebase security rules (fail-first tests with emulator)  
4. Basic React components (no Storybook)  
   - LobbyCreate
   - LobbyWaitingRoom
   - PlayerList

Testing Focus:
- Unit tests for:
  • LobbyRepository
  • Firebase security rules
  • Spotify token handling
- Manual testing for:
  • UI components
  • User flows
  • Real-time updates
```

This approach:
1. Reduces initial setup time
2. Focuses on critical functionality
3. Allows faster iteration
4. Can add tools later if needed

Would you like to proceed with this simplified approach?

```plaintext
PROS of Using These Tools
1. Storybook
   ✓ Great for:
   - Complex UI components (like our SearchDialog)
   - Team collaboration
   - Component documentation
   
   ✗ Overkill for:
   - Simple, one-off components
   - Solo developer
   - Tight deadlines

2. Jest
   ✓ Essential for:
   - Critical business logic (lobby management)
   - Firebase interactions
   - Spotify API integration
   
   ✗ Can skip:
   - Simple UI components
   - Static pages
   - Prototype phase

3. Lighthouse CI
   ✓ Valuable for:
   - Production deployment
   - Performance critical features
   
   ✗ Unnecessary for:
   - MVP phase
   - Internal tools
   - Learning projects
```

```plaintext
MINIMAL VIABLE SETUP
1. Keep Jest (but start small)
   - Test critical paths only:
     • Lobby creation/joining
     • Spotify token handling
     • Firebase security rules
   - Skip testing:
     • Simple UI components
     • Static pages
     • Helper functions

2. Skip Storybook initially
   - Build components directly in the app
   - Add it later if:
     • UI becomes complex
     • Team grows
     • Need component documentation

3. Skip Lighthouse CI initially
   - Use browser dev tools for performance
   - Add it when:
     • Going to production
     • Performance becomes an issue
     • Team needs automated checks
```

```plaintext
Sprint 1 – "Domain & API skeleton" (2 d)  
1. Write Lobby context model (TypeScript interfaces only)  
2. Implement LobbyRepository (create/read/update, unit-tested)  
3. Draft Firebase security rules (fail-first tests with emulator)  
4. Basic React components (no Storybook)  
   - LobbyCreate
   - LobbyWaitingRoom
   - PlayerList

Testing Focus:
- Unit tests for:
  • LobbyRepository
  • Firebase security rules
  • Spotify token handling
- Manual testing for:
  • UI components
  • User flows
  • Real-time updates
```

---

**User**

I am a one developer tha twants to deliver this as soon as possible using AI. How would you adjust the requirmenets? We could skip Storybook and maybe Lighthouse CI

---

**Cursor**

For a solo developer using AI to deliver quickly, let's strip this down to the absolute essentials. Here's the streamlined plan:

```
SPRINT 1 - "Core Functionality" (2-3 days)
Focus: Get the basic game working, no fancy tooling

1. Essential Setup (½ day)
   - Firebase project
   - Spotify Developer account
   - Basic React + Vite setup
   - Environment variables

2. Core Data Models (½ day)
   - TypeScript interfaces for:
     • Lobby
     • Player
     • Track
   - Firebase security rules (basic)

3. Basic UI (1 day)
   - Create Lobby page
   - Join Lobby page
   - Player list
   - Simple track search
   - Basic styling (Tailwind)

4. Core Logic (1 day)
   - Lobby creation/joining
   - Spotify search integration
   - Basic playlist management
```

Key Changes from Original Plan:
```
REMOVED:
- Storybook (not needed for solo dev)
- Lighthouse CI (can use browser tools)
- Complex testing setup
- Detailed documentation
- Complex state management

KEPT:
- Basic Jest tests for critical paths
- Simple Firebase security rules
- TypeScript (helps AI and prevents bugs)
```

Development Flow with AI:
```
1. Start with UI
   - Ask AI to generate basic components
   - Modify as needed
   - Quick visual testing

2. Add Firebase
   - AI helps with security rules
   - Basic CRUD operations
   - Real-time updates

3. Add Spotify
   - Search functionality
   - Playlist management
   - Token handling

4. Polish
   - Error handling
   - Loading states
   - Basic animations
```

Example AI Prompt Structure:
```
"Generate a React component for [feature] with:
- TypeScript
- Tailwind CSS
- Firebase integration
- Error handling
- Loading states"
```

This approach:
1. Gets you to a working product faster
2. Uses AI effectively for code generation
3. Focuses on core functionality
4. Allows for quick iterations

Would you like to start with any particular component or feature?

```plaintext
SPRINT 1 - "Core Functionality" (2-3 days)
Focus: Get the basic game working, no fancy tooling

1. Essential Setup (½ day)
   - Firebase project
   - Spotify Developer account
   - Basic React + Vite setup
   - Environment variables

2. Core Data Models (½ day)
   - TypeScript interfaces for:
     • Lobby
     • Player
     • Track
   - Firebase security rules (basic)

3. Basic UI (1 day)
   - Create Lobby page
   - Join Lobby page
   - Player list
   - Simple track search
   - Basic styling (Tailwind)

4. Core Logic (1 day)
   - Lobby creation/joining
   - Spotify search integration
   - Basic playlist management
```

```plaintext
REMOVED:
- Storybook (not needed for solo dev)
- Lighthouse CI (can use browser tools)
- Complex testing setup
- Detailed documentation
- Complex state management

KEPT:
- Basic Jest tests for critical paths
- Simple Firebase security rules
- TypeScript (helps AI and prevents bugs)
```

```plaintext
1. Start with UI
   - Ask AI to generate basic components
   - Modify as needed
   - Quick visual testing

2. Add Firebase
   - AI helps with security rules
   - Basic CRUD operations
   - Real-time updates

3. Add Spotify
   - Search functionality
   - Playlist management
   - Token handling

4. Polish
   - Error handling
   - Loading states
   - Basic animations
```

```plaintext
"Generate a React component for [feature] with:
- TypeScript
- Tailwind CSS
- Firebase integration
- Error handling
- Loading states"
```

---

**User**

Spotify serach functionality and playlist management will be after Lobby - 
host will press start game and that will take to the game setup.


---

**Cursor**

Ah, you're right! Let's reorganize the flow to be more logical. Here's the revised plan focusing first on the lobby and game setup:

```
SPRINT 1 - "Lobby & Game Setup" (2-3 days)
Focus: Get players into a lobby and ready to start

1. Essential Setup (½ day)
   - Firebase project
   - Basic React + Vite setup
   - Environment variables
   - Basic routing

2. Core Data Models (½ day)
   - TypeScript interfaces:
     • Lobby
     • Player
   - Firebase security rules (basic)

3. Lobby Flow (1-1.5 days)
   A. Host Flow:
      - Create Lobby page
      - Generate shareable link
      - Start Game button
      - Player list view

   B. Guest Flow:
      - Join Lobby page
      - Enter name
      - See other players
      - Wait for host

4. Game Setup (½ day)
   - Game state management
   - Round tracking
   - Basic score structure
```

Data Structure:
```typescript
// Lobby
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
    }
  };
  currentRound?: number;
  maxPlayers: number;
  createdAt: Timestamp;
}

// Game State (added when game starts)
interface GameState {
  round: number;
  currentTrack?: string;
  scores: {
    [playerId: string]: number;
  };
  playlistId?: string; // Added when Spotify integration is ready
}
```

Firebase Structure:
```
/lobbies/{lobbyId}
  ├─ hostId: string
  ├─ status: string
  ├─ maxPlayers: number
  ├─ createdAt: timestamp
  └─ players/
      ├─ {playerId}/
      │   ├─ name: string
      │   ├─ isHost: boolean
      │   └─ score: number
      └─ {playerId}/
          └─ ...

/games/{lobbyId}  // Created when game starts
  ├─ round: number
  ├─ currentTrack?: string
  ├─ scores: {[playerId: string]: number}
  └─ playlistId?: string
```

Basic Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

Next Steps:
1. Create basic lobby creation flow
2. Add player joining functionality
3. Implement real-time player list
4. Add game start transition

Would you like to start with any of these components? I can help generate the code for any part you want to tackle first.

```plaintext
SPRINT 1 - "Lobby & Game Setup" (2-3 days)
Focus: Get players into a lobby and ready to start

1. Essential Setup (½ day)
   - Firebase project
   - Basic React + Vite setup
   - Environment variables
   - Basic routing

2. Core Data Models (½ day)
   - TypeScript interfaces:
     • Lobby
     • Player
   - Firebase security rules (basic)

3. Lobby Flow (1-1.5 days)
   A. Host Flow:
      - Create Lobby page
      - Generate shareable link
      - Start Game button
      - Player list view

   B. Guest Flow:
      - Join Lobby page
      - Enter name
      - See other players
      - Wait for host

4. Game Setup (½ day)
   - Game state management
   - Round tracking
   - Basic score structure
```

```typescript
// Lobby
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
    }
  };
  currentRound?: number;
  maxPlayers: number;
  createdAt: Timestamp;
}

// Game State (added when game starts)
interface GameState {
  round: number;
  currentTrack?: string;
  scores: {
    [playerId: string]: number;
  };
  playlistId?: string; // Added when Spotify integration is ready
}
```

```plaintext
/lobbies/{lobbyId}
  ├─ hostId: string
  ├─ status: string
  ├─ maxPlayers: number
  ├─ createdAt: timestamp
  └─ players/
      ├─ {playerId}/
      │   ├─ name: string
      │   ├─ isHost: boolean
      │   └─ score: number
      └─ {playerId}/
          └─ ...

/games/{lobbyId}  // Created when game starts
  ├─ round: number
  ├─ currentTrack?: string
  ├─ scores: {[playerId: string]: number}
  └─ playlistId?: string
```

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

---

**User**

4. Game setup 
should allow host create the shared playlist
and guests add songs to it
then save in firebase which guests added which song in the game 
host can see song count - but not which songs are added - and start the game.

---

**Cursor**

Ah, I see! Let's revise the game setup phase to include playlist creation and song collection before the game starts. Here's the detailed breakdown:

```
SPRINT 1 - "Lobby & Game Setup" (2-3 days)
[Previous parts remain the same...]

4. Game Setup & Playlist Collection (1-1.5 days)
   A. Host Flow:
      - Create shared playlist
      - See player count and song count
      - Start game button (enabled when all players added songs)
      - Can't see which songs were added

   B. Guest Flow:
      - Search and add songs to shared playlist
      - See their own added songs
      - Can't see other players' songs
      - Wait for host to start

   C. Data Structure:
      - Track who added which song
      - Store song metadata
      - Track playlist status
```

Updated Data Models:
```typescript
// Lobby (updated)
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
      hasAddedSongs: boolean;  // Track if player has added songs
    }
  };
  maxPlayers: number;
  createdAt: Timestamp;
}

// Playlist Collection (new)
interface PlaylistCollection {
  lobbyId: string;
  playlistId: string;  // Spotify playlist ID
  songs: {
    [trackUri: string]: {
      addedBy: string;  // playerId
      trackInfo: {
        name: string;
        artists: string[];
        duration_ms: number;
        preview_url?: string;
      };
      addedAt: Timestamp;
    }
  };
  stats: {
    totalSongs: number;
    playersWithSongs: number;
  };
}
```

Firebase Structure:
```
/lobbies/{lobbyId}
  ├─ hostId: string
  ├─ status: string
  ├─ maxPlayers: number
  ├─ createdAt: timestamp
  └─ players/
      ├─ {playerId}/
      │   ├─ name: string
      │   ├─ isHost: boolean
      │   ├─ score: number
      │   └─ hasAddedSongs: boolean
      └─ ...

/playlists/{lobbyId}
  ├─ playlistId: string
  ├─ songs/
  │   ├─ {trackUri}/
  │   │   ├─ addedBy: string
  │   │   ├─ trackInfo: {...}
  │   │   └─ addedAt: timestamp
  │   └─ ...
  └─ stats/
      ├─ totalSongs: number
      └─ playersWithSongs: number
```

Security Rules:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
    
    match /playlists/{lobbyId} {
      allow read: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
      allow create: if request.auth != null 
        && get(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid)).data.isHost == true;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

Game Setup Flow:
1. Host creates lobby
2. Guests join
3. Host clicks "Start Song Collection"
   - Creates Spotify playlist
   - Updates lobby status to 'collecting_songs'
4. Guests add songs
   - Search Spotify
   - Add to playlist
   - Can't see other players' songs
5. Host sees:
   - How many players have added songs
   - Total song count
   - "Start Game" button (enabled when all players have added songs)
6. Host starts game
   - Lobby status changes to 'in_progress'
   - Songs are locked (no more additions)
   - Game begins

Would you like me to detail any specific part of this flow or start generating code for a particular component?

```plaintext
SPRINT 1 - "Lobby & Game Setup" (2-3 days)
[Previous parts remain the same...]

4. Game Setup & Playlist Collection (1-1.5 days)
   A. Host Flow:
      - Create shared playlist
      - See player count and song count
      - Start game button (enabled when all players added songs)
      - Can't see which songs were added

   B. Guest Flow:
      - Search and add songs to shared playlist
      - See their own added songs
      - Can't see other players' songs
      - Wait for host to start

   C. Data Structure:
      - Track who added which song
      - Store song metadata
      - Track playlist status
```

```typescript
// Lobby (updated)
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
      hasAddedSongs: boolean;  // Track if player has added songs
    }
  };
  maxPlayers: number;
  createdAt: Timestamp;
}

// Playlist Collection (new)
interface PlaylistCollection {
  lobbyId: string;
  playlistId: string;  // Spotify playlist ID
  songs: {
    [trackUri: string]: {
      addedBy: string;  // playerId
      trackInfo: {
        name: string;
        artists: string[];
        duration_ms: number;
        preview_url?: string;
      };
      addedAt: Timestamp;
    }
  };
  stats: {
    totalSongs: number;
    playersWithSongs: number;
  };
}
```

```plaintext
/lobbies/{lobbyId}
  ├─ hostId: string
  ├─ status: string
  ├─ maxPlayers: number
  ├─ createdAt: timestamp
  └─ players/
      ├─ {playerId}/
      │   ├─ name: string
      │   ├─ isHost: boolean
      │   ├─ score: number
      │   └─ hasAddedSongs: boolean
      └─ ...

/playlists/{lobbyId}
  ├─ playlistId: string
  ├─ songs/
  │   ├─ {trackUri}/
  │   │   ├─ addedBy: string
  │   │   ├─ trackInfo: {...}
  │   │   └─ addedAt: timestamp
  │   └─ ...
  └─ stats/
      ├─ totalSongs: number
      └─ playersWithSongs: number
```

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
    
    match /playlists/{lobbyId} {
      allow read: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
      allow create: if request.auth != null 
        && get(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid)).data.isHost == true;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

---

**User**

Do not add code yet. Create a sprint file (limit to 500 lines) that would contain all the details and steps we need for lobby + game setup
I think the 1. essential setup we already have


---

**Cursor**

I'll create a focused sprint plan for the lobby and game setup phase, assuming essential setup is done.

```markdown
# Sprint: Lobby & Game Setup
_Status: Planning Phase_

## Overview
Build the core lobby system and game setup flow where players can join, add songs, and prepare for the guessing game.

## Core Features
1. Lobby Creation & Management
2. Player Joining System
3. Song Collection Phase
4. Game Start Transition

## Data Models

### Lobby
```typescript
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
      hasAddedSongs: boolean;
    }
  };
  maxPlayers: number;
  createdAt: Timestamp;
}
```

### Playlist Collection
```typescript
interface PlaylistCollection {
  lobbyId: string;
  playlistId: string;
  songs: {
    [trackUri: string]: {
      addedBy: string;
      trackInfo: {
        name: string;
        artists: string[];
        duration_ms: number;
        preview_url?: string;
      };
      addedAt: Timestamp;
    }
  };
  stats: {
    totalSongs: number;
    playersWithSongs: number;
  };
}
```

## Firebase Structure
```
/lobbies/{lobbyId}
  ├─ hostId: string
  ├─ status: string
  ├─ maxPlayers: number
  ├─ createdAt: timestamp
  └─ players/
      ├─ {playerId}/
      │   ├─ name: string
      │   ├─ isHost: boolean
      │   ├─ score: number
      │   └─ hasAddedSongs: boolean
      └─ ...

/playlists/{lobbyId}
  ├─ playlistId: string
  ├─ songs/
  │   ├─ {trackUri}/
  │   │   ├─ addedBy: string
  │   │   ├─ trackInfo: {...}
  │   │   └─ addedAt: timestamp
  │   └─ ...
  └─ stats/
      ├─ totalSongs: number
      └─ playersWithSongs: number
```

## User Flows

### Host Flow
1. Create Lobby
   - Enter name
   - Set max players (default: 8)
   - Get shareable link

2. Lobby Management
   - See joined players
   - Start song collection phase
   - Monitor song collection progress
   - Start game when ready

### Guest Flow
1. Join Lobby
   - Enter name
   - See other players
   - Wait for host

2. Song Collection
   - Add songs to shared playlist
   - See own added songs
   - Wait for game start

## Implementation Steps

### Phase 1: Basic Lobby (1 day)
1. Create Lobby Page
   - Name input
   - Max players setting
   - Create button
   - Share link generation

2. Join Lobby Page
   - Name input
   - Join button
   - Error handling

3. Player List Component
   - Real-time updates
   - Player cards
   - Host indicator

### Phase 2: Song Collection (1-1.5 days)
1. Host Controls
   - Start collection button
   - Progress indicators
   - Start game button

2. Guest Song Addition
   - Search interface
   - Song selection
   - Add to playlist
   - Own songs list

3. Playlist Management
   - Create shared playlist
   - Track additions
   - Update statistics

## Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
    
    match /playlists/{lobbyId} {
      allow read: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
      allow create: if request.auth != null 
        && get(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid)).data.isHost == true;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

## Testing Focus
1. Critical Paths
   - Lobby creation
   - Player joining
   - Song addition
   - Game start

2. Edge Cases
   - Duplicate names
   - Max players reached
   - Network disconnection
   - Invalid song URIs

## Success Criteria
- Host can create lobby and share link
- Guests can join with names
- Host can start song collection
- Guests can add songs
- Host can see progress and start game
- All data properly stored in Firebase
- Real-time updates working
- Basic error handling in place

## Next Steps
1. Begin with lobby creation flow
2. Add player joining system
3. Implement song collection
4. Add game start transition

## Notes
- Keep UI simple and functional
- Focus on core functionality first
- Add polish after basic flow works
- Document any Spotify API limitations
```

Would you like me to expand on any part of this plan or shall we start implementing a specific component?

```markdown
# Sprint: Lobby & Game Setup
_Status: Planning Phase_

## Overview
Build the core lobby system and game setup flow where players can join, add songs, and prepare for the guessing game.

## Core Features
1. Lobby Creation & Management
2. Player Joining System
3. Song Collection Phase
4. Game Start Transition

## Data Models

### Lobby
```typescript
interface Lobby {
  id: string;
  hostId: string;
  status: 'waiting' | 'collecting_songs' | 'in_progress' | 'finished';
  players: {
    [playerId: string]: {
      name: string;
      isHost: boolean;
      score: number;
      hasAddedSongs: boolean;
    }
  };
  maxPlayers: number;
  createdAt: Timestamp;
}
```

### Playlist Collection
```typescript
interface PlaylistCollection {
  lobbyId: string;
  playlistId: string;
  songs: {
    [trackUri: string]: {
      addedBy: string;
      trackInfo: {
        name: string;
        artists: string[];
        duration_ms: number;
        preview_url?: string;
      };
      addedAt: Timestamp;
    }
  };
  stats: {
    totalSongs: number;
    playersWithSongs: number;
  };
}
```

## Firebase Structure
```

```plaintext

## User Flows

### Host Flow
1. Create Lobby
   - Enter name
   - Set max players (default: 8)
   - Get shareable link

2. Lobby Management
   - See joined players
   - Start song collection phase
   - Monitor song collection progress
   - Start game when ready

### Guest Flow
1. Join Lobby
   - Enter name
   - See other players
   - Wait for host

2. Song Collection
   - Add songs to shared playlist
   - See own added songs
   - Wait for game start

## Implementation Steps

### Phase 1: Basic Lobby (1 day)
1. Create Lobby Page
   - Name input
   - Max players setting
   - Create button
   - Share link generation

2. Join Lobby Page
   - Name input
   - Join button
   - Error handling

3. Player List Component
   - Real-time updates
   - Player cards
   - Host indicator

### Phase 2: Song Collection (1-1.5 days)
1. Host Controls
   - Start collection button
   - Progress indicators
   - Start game button

2. Guest Song Addition
   - Search interface
   - Song selection
   - Add to playlist
   - Own songs list

3. Playlist Management
   - Create shared playlist
   - Track additions
   - Update statistics

## Security Rules
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lobbies/{lobbyId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
    
    match /playlists/{lobbyId} {
      allow read: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
      allow create: if request.auth != null 
        && get(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid)).data.isHost == true;
      allow update: if request.auth != null 
        && exists(/databases/$(database)/documents/lobbies/$(lobbyId)/players/$(request.auth.uid));
    }
  }
}
```

## Testing Focus
1. Critical Paths
   - Lobby creation
   - Player joining
   - Song addition
   - Game start

2. Edge Cases
   - Duplicate names
   - Max players reached
   - Network disconnection
   - Invalid song URIs

## Success Criteria
- Host can create lobby and share link
- Guests can join with names
- Host can start song collection
- Guests can add songs
- Host can see progress and start game
- All data properly stored in Firebase
- Real-time updates working
- Basic error handling in place

## Next Steps
1. Begin with lobby creation flow
2. Add player joining system
3. Implement song collection
4. Add game start transition

## Notes
- Keep UI simple and functional
- Focus on core functionality first
- Add polish after basic flow works
- Document any Spotify API limitations
```

