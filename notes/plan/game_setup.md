# Sprint: Lobby & Game Setup
_Status: Planning Phase_

## As a security engineer
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

## Acceptance Criteria:
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
lobbies/{lobbyId}
├─ hostId: string
├─ status: string
├─ maxPlayers: number
├─ createdAt: timestamp
└─ players/
├─ {playerId}/
│ ├─ name: string
│ ├─ isHost: boolean
│ ├─ score: number
│ └─ hasAddedSongs: boolean
└─ ...
/playlists/{lobbyId}
├─ playlistId: string
├─ songs/
│ ├─ {trackUri}/
│ │ ├─ addedBy: string
│ │ ├─ trackInfo: {...}
│ │ └─ addedAt: timestamp
│ └─ ...
└─ stats/
├─ totalSongs: number
└─ playersWithSongs: number




## User Flows

Game Setup Flow:
Host creates lobby
Guests join
Host clicks "Start Song Collection"
Creates Spotify playlist
Updates lobby status to 'collecting_songs'
Guests add songs
Search Spotify
Add to playlist
Can't see other players' songs
Host sees:
How many players have added songs
Total song count
"Start Game" button (enabled when all players have added songs)
Host starts game
Lobby status changes to 'in_progress'
Songs are locked (no more additions)
Game begins

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

# Technical details:

Backend obtains an “app-only” token
Use the Client-Credentials flow (no user context) ⇒ access token with no user scopes.
This token is perfect for read-only endpoints like GET /v1/search.
Cache it in memory until it expires (60 min) to reduce traffic to Spotify’s auth server.
2 Guest types a query
Front-end debounce(400 ms) → POST /api/spotify/search?q=…&type=track.
Cloud Function / Express route forwards the call with the cached app token.
Response includes track name, artist, album art, URI, duration, preview\url (if any).
3 Guest picks a track
Front-end emits addTrackProposal to Firebase at
/lobbies/{id}/proposals/{trackUri}
Apply to game_setup.m...
}
UI immediately shows it as “pending”.
4 Host-token bot finalises the add
Cloud Function onCreate listener on /proposals/*
Reads the lobby’s stored hostRefreshToken
Exchanges → host access token (scopes playlist-modify-private|public)
POST /v1/playlists/{playlistId}/tracks body { uris:[trackUri] }
On success:
Move document to /playlistMeta/{trackUri} with addedBy : playerId
Delete from proposals / mark as accepted.
On failure: write error field → front-end displays toast.
Guests never touch Spotify credentials; the only privileged calls happen server-side.
B. UX & real-time considerations
• Autocomplete / preview
Limit results to 10 tracks, 3 requests / sec per guest.
Display 30-sec preview_url if available; otherwise grey out the play button (complies with Spotify TOS on previews).
Duplicate prevention
Server rejects a proposal if the track already exists in /playlistMeta.
Abuse & rate limiting
Search endpoint: 30 req / sec / client-id (§Spotify rate limits).
Cloud Function should apply per-IP quota (> userRules: security best practice).
C. Sprint-level impact
• Add tasks to Sprint 2
2.1 Build SearchDialog component (Typeahead + list)
2.2 Implement /api/spotify/search wrapper + caching logic
2.3 Write Firebase rule: only authenticated (even if anonymous) users may write to /proposals/{trackUri}
Add tasks to Sprint 3
3.5 Cloud Function onProposalCreated (add to playlist, move metadata)
3.6 End-to-end test: two browsers, guest adds song, host playlist updates within 2 s.
D. Compliance checkpoints
✓ Client-Credentials token is stored server-side only.
✓ All playlist mutations use the host’s user token (required by Spotify’s policy).
✓ We display Spotify attribution and album art exactly as returned (§ Developer Terms).
✓ No secrets leak to the browser; all env vars remain in server runtime.
This approach gives guests the full “search & pick” experience while keeping them anonymous and staying within Spotify’s current API constraints.
OPTION A “One-token model”
Only the host authorises Spotify; everyone else stays anonymous.
What becomes simpler
On-boarding Guests never see an OAuth screen → zero drop-off.
Token storage Exactly one refresh-token in the DB; easy to rotate or revoke.
Playlist ownership Playlist is always owned by the host, so ACL issues disappear.
What grows in complexity / bug risk
Extra backend paths You must implement the “proposal → approve → add” workflow and keep it race-free.
False attribution Spotify’s added_by will always be the host. You have to maintain custom metadata and keep it in sync if a track is later removed or reordered.
Rate limits All playlist writes hit a single user-token, so rapid, parallel additions can 429.
Net simplicity score
Fewer moving parts in auth, more moving parts in data-flow.
Best when your priority is friction-free guest entry and you’re comfortable writing a small dispatcher Cloud Function.
Great—Approach A (“host-only Spotify token, guests remain anonymous”) is locked in.
Below is the feature-2 delivery plan that sits on top of the lobby work we already outlined.
════════════════════════════════ Feature #2 ― Add Songs to Shared Playlist (Host-Only Token) ════════════════════════════════
A. Core Architecture Decisions
Search authority
Server holds a client-credentials token (read-only) for GET /v1/search.
Token cached in memory (≈60 min) and rotated automatically.
Write authority
Host granted playlist-modify scopes during lobby creation → refresh token stored server-side (env-encrypted).
Cloud Function exchanges refresh→access token whenever a guest proposal appears.
Data shapes
Apply to game_setup.m...
}
Security rules (Firebase)
Anonymous users may read playlistMeta & proposals; write only their own proposal doc.
Cloud Function runs with admin privileges; no secrets reach the client.
Failure / edge paths
Duplicate track or 429 from Spotify ⇒ mark proposal → status:"rejected", reason.
Host token revoked ⇒ lobby goes into “maintenance” banner and prompts host to re-authenticate.
B. Milestones & Sprints (adds on to previous timeline)
Milestone 2 – “Playlist Collaboration MVP”
Sprint 4 (3 d) — Guest Search & Proposal
4.1 SearchDialog component with debounce & preview audio
4.2 /api/spotify/search route + token-cache middleware
4.3 Firebase rules: guests can write proposals ≤ 5 active each
4.4 UX polish: duplicate warning, proposal list with avatars
Sprint 5 (2 d) — Proposal Processing & Playlist Sync
5.1 Cloud Function onProposalCreated → add track via host token
5.2 Create playlist on first accept; store playlistId & initial snapshotId
5.3 Move proposal → playlistMeta, broadcast toast “Track added by X”
5.4 E2E test: two browsers + emulator, latency < 2 s
Sprint 6 (2 d) — Hardening & Rate-Limit Guards
6.1 Exponential back-off + retry queue for transient Spotify 5xx
6.2 Batch additions if ≥ 5 pending proposals
6.3 Alerting: Slack webhook if > 3 failures in 5 min
6.4 Accessibility pass for SearchDialog (keyboard nav, screen reader)
Milestone 2 exit criteria
Guest can search > select > see track appear in < 3 s.
No secrets exposed in network tab.
Manual chaos test: drop network, duplicate proposals, token expiry—all handled gracefully.
C. Workflow Add-ons for these sprints
New CI job: Jest + Firebase-emulator tests for security rules on /proposals.
Mock-Spotify server for local dev to avoid rate limits.
Add docs/playlist/SEARCH_API.md and docs/playlist/PROPOSAL_FLOW.md (≤500 lines each, cross-linked from INDEX.md).
D. Cautionary Advice
Remember that preview_url is not guaranteed; the UI must tolerate nulls.
Store snapshotId returned by each playlist mutation—handy for later rollbacks.
Clean up orphaned proposals on lobby end to avoid dangling writes against an expired refresh token.
E. Next Step
Convert Sprint 4 items into granular user stories with acceptance criteria and start the ticketing board.
When you’re ready, we’ll draft those stories (no code, just wording) so the team can pick them up.


Absolutely—guests can stay anonymous and still use an in-app “Search Spotify” dialog.
Below is a practical flow that satisfies both Spotify’s auth model and our “no-login-for-guests” rule.
A. How anonymous search works
1 Backend obtains an “app-only” token
Use the Client-Credentials flow (no user context) ⇒ access token with no user scopes.
This token is perfect for read-only endpoints like GET /v1/search.
Cache it in memory until it expires (60 min) to reduce traffic to Spotify’s auth server.
2 Guest types a query
Front-end debounce(400 ms) → POST /api/spotify/search?q=…&type=track.
Cloud Function / Express route forwards the call with the cached app token.
Response includes track name, artist, album art, URI, duration, preview\url (if any).
3 Guest picks a track
Front-end emits addTrackProposal to Firebase at
/lobbies/{id}/proposals/{trackUri}
Apply to game_setup.m...
}
UI immediately shows it as “pending”.
4 Host-token bot finalises the add
Cloud Function onCreate listener on /proposals/*
Reads the lobby’s stored hostRefreshToken
Exchanges → host access token (scopes playlist-modify-private|public)
POST /v1/playlists/{playlistId}/tracks body { uris:[trackUri] }
On success:
Move document to /playlistMeta/{trackUri} with addedBy : playerId
Delete from proposals / mark as accepted.
On failure: write error field → front-end displays toast.
Guests never touch Spotify credentials; the only privileged calls happen server-side.
B. UX & real-time considerations
• Autocomplete / preview
Limit results to 10 tracks, 3 requests / sec per guest.
Display 30-sec preview_url if available; otherwise grey out the play button (complies with Spotify TOS on previews).
Duplicate prevention
Server rejects a proposal if the track already exists in /playlistMeta.
Abuse & rate limiting
Search endpoint: 30 req / sec / client-id (§Spotify rate limits).
Cloud Function should apply per-IP quota (> userRules: security best practice).
C. Sprint-level impact
• Add tasks to Sprint 2
2.1 Build SearchDialog component (Typeahead + list)
2.2 Implement /api/spotify/search wrapper + caching logic
2.3 Write Firebase rule: only authenticated (even if anonymous) users may write to /proposals/{trackUri}
Add tasks to Sprint 3
3.5 Cloud Function onProposalCreated (add to playlist, move metadata)
3.6 End-to-end test: two browsers, guest adds song, host playlist updates within 2 s.
D. Compliance checkpoints
✓ Client-Credentials token is stored server-side only.
✓ All playlist mutations use the host’s user token (required by Spotify’s policy).
✓ We display Spotify attribution and album art exactly as returned (§ Developer Terms).
✓ No secrets leak to the browser; all env vars remain in server runtime.
This approach gives guests the full “search & pick” experience while keeping them anonymous and staying within Spotify’s current API constraints.