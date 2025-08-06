todo for Lobby.tsx
DONE --- 1. Players do not see their added songs. After adding song, MySongs.tsx is not updated/populated.

Root cause
• MySongs.tsx listens to the sub-collection ​lobbies/{id}/proposals​, but SearchDialog writes straight into ​playlists/{id}​.
• Because no proposal documents are created, the onSnapshot inside MySongs never fires, so the list stays empty.

Two possible ways to solve it (pick one and follow it consistently)

──────────────────────────────────────── OPTION A – keep the new “playlist” flow (simpler, matches the rest of the app) ────────────────────────────────────────

Data layer
a. Add a helper in src/services/firebase.ts

export const subscribeUserSongs = (
  lobbyId: string,
  userId: string,
  cb: (tracks: Track[]) => void,
) => {
  const ref = doc(db, 'playlists', lobbyId);
  return onSnapshot(ref, snap => {
    if (!snap.exists()) { cb([]); return; }
    const songs = snap.data().songs ?? {};
    cb(
      Object.values(songs)
        .filter((s: any) => s.addedBy === userId)
        .map((s: any) => ({ ...s.trackInfo } as Track))
    );
  });
};
MySongs.tsx
• Replace the import/usage of subscribeTrackProposals with subscribeUserSongs.
• Drop the status logic (every track is already “added”).
• Keep the same UI skeleton; just map over the returned Track[].

SearchDialog.tsx
• Replace subscribeTrackProposals with subscribePlaylistCollection (or a small wrapper) so duplicate detection looks at the real playlist.
• Remove the commented addTrackProposal line; the current addTrackToPlaylist call is already correct.

PlaylistStats and Game components already consume playlist data, so no change needed.

──────────────────────────────────────── OPTION B – revert to the original “proposal / approval” flow ────────────────────────────────────────

Re-enable addTrackProposal in SearchDialog and remove addTrackToPlaylist.
Keep MySongs as is.
Implement a host-side approval UI that moves an approved proposal into playlists/{lobbyId}.songs and updates its proposal.status to "approved".
Update PlaylistStats to count approved proposals instead of songs list.
OPTION A usually wins because:
• PlaylistStats and Game are already built around playlists/{id}.songs.
• No extra approval UI is required right now.

──────────────────────────────────────── Hidden pitfalls (“under-water stones”)

Firestore doc size
The songs map grows inside a single document; 1 MiB is the hard limit.
• Mitigation: If you expect > 200-300 songs, switch to a sub-collection (e.g. playlists/{id}/songs/{uri}) later.

Field-path characters
addTrackToPlaylist uses the field path songs.${trackUri}. Characters “.” and “$” are forbidden; Spotify URIs have “:”, which is safe, but watch out if you ever switch to plain URLs.

Uninitialised document
subscribeUserSongs / subscribePlaylistCollection must handle the case where the playlist document does not exist until the first song is added (return empty list).

Race conditions / concurrent writes
updatePlaylistStats and song insertion happen in two separate updateDoc calls; if players add at the same time, counters can drift. The current code uses increment() which is atomic, so it is safe—as long as security rules allow both fields to be updated together.

Duplicate detection
The new duplicate logic needs to check the whole playlist, not just the current user. Otherwise two different players can add the same track.

Anonymous vs authenticated UID
The userId that you pass to subscribeUserSongs must be exactly the same string you store in songs.{uri}.addedBy. Double-check you are not mixing Firebase UID with a custom “player id”.

Memory leaks
Ensure the unsubscribe function returned from onSnapshot is called in useEffect cleanup; otherwise components re-mounting will accumulate listeners.

Security rules
If you move to a sub-collection or change write paths, update Firestore security rules accordingly; otherwise writes may silently fail.

Follow the steps in OPTION A (or OPTION B if you need formal approval flow) and the players’ “My Songs” panel will update in real time as soon as a track is added.


DONE --- 2. Host does not have MySongs.tsx component. Also, host should see which players are not ready - list of all players

Implementation blueprint for TODO # 2
(“Host does not have MySongs.tsx component. Also, host should see which players are not ready – list of all players”)

──────────────────────────────────────── A. Show “My Songs” to the host ────────────────────────────────────────

Locate the conditional render in src/components/Lobby/Lobby.tsx
{/* My Songs for non-host players */}
{!isHost && (
  <MySongs lobbyId={lobbyId!} userId={currentUserId} />
)}
Remove the !isHost guard (or invert the logic) so the block executes for everyone:
<MySongs lobbyId={lobbyId!} userId={currentUserId} />
• Nothing else is required—MySongs already filters proposals by userId, so it works for the host out-of-the-box.
Potential pitfalls (“under-water stones”) • UI crowding: the host now sees both PlaylistStats and MySongs. If space is tight, consider stacking them or wrapping each in a collapsible <details> section.
• Firestore rules: the host’s userId is treated like any other player, so security rules based on proposedBy == request.auth.uid will still hold. Verify this if custom rules exist.
• Mobile layout: test on narrow screens; MySongs was previously never displayed there for hosts.

──────────────────────────────────────── B. Give the host an explicit list of players who are NOT ready ────────────────────────────────────────

Create a small presentational component, e.g. NotReadyList.tsx (same folder as PlayerList).
Props: { players: Record<string, Player> }.

Core logic:

const notReady = Object.values(players).filter(p => !p.isReady);
if (notReady.length === 0) return null;

return (
  <div className="not-ready-list">
    <h5>Waiting for:</h5>
    <ul>
      {notReady.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  </div>
);
Insert it in Lobby.tsx, inside the “collecting_songs” branch, visible only to the host:

{isHost && lobby.status === 'collecting_songs' && (
  <NotReadyList players={lobby.players} />
)}
Styling (CSS) • Keep it compact; e.g. wrap in a semi-transparent box or badge style.
• Ensure it adapts to long player names (ellipsis or wrap).
• For >5 players consider a max-height with overflow-y: auto.

Potential pitfalls • Race conditions: Firestore updates are near-real-time, but UI may momentarily show a player as “waiting” after they click Ready. If this flicker matters, debounce the list for ~300 ms.
• Large lobbies: list size could blow up; add scroll or only show first N names plus “+k more”.
• Host readiness: the host themselves can appear in the not-ready list; that’s desirable because the game cannot start until every player (including host) is ready.

──────────────────────────────────────── C. Regression-test matrix ──────────────────────────────────────── ✓ Host adds a song → appears immediately under “My Songs”.
✓ Non-host behaviour unchanged.
✓ Host toggles Ready/Unready → disappears/appears in NotReadyList.
✓ Game start button remains disabled until NotReadyList is empty (logic already enforced by getAllPlayersReady()).

──────────────────────────────────────── D. Optional polish / backlog ──────────────────────────────────────── • Collapse “My Songs” by default for the host to reduce clutter.
• Inline readiness badges in PlayerList already exist; you can reuse their colour scheme for the new list for consistency.
• Persist host’s UI state (collapsed/expanded) in localStorage for better UX.

Follow these steps and the host will have full song-viewing capability and an at-a-glance view of who is still preparing, without disrupting existing player flows.


DONE --- 3. host page is rendered by ?host=true parameter gives control to the game lobby. It should be inferred from host Spotify user session instead of URL flag which can be set by users.


Implementation blueprint for TODO # 2
(“Host does not have MySongs.tsx component. Also, host should see which players are not ready – list of all players”)

──────────────────────────────────────── A. Show “My Songs” to the host ────────────────────────────────────────

Locate the conditional render in src/components/Lobby/Lobby.tsx
{/* My Songs for non-host players */}
{!isHost && (
  <MySongs lobbyId={lobbyId!} userId={currentUserId} />
)}
Remove the !isHost guard (or invert the logic) so the block executes for everyone:
<MySongs lobbyId={lobbyId!} userId={currentUserId} />
• Nothing else is required—MySongs already filters proposals by userId, so it works for the host out-of-the-box.
Potential pitfalls (“under-water stones”) • UI crowding: the host now sees both PlaylistStats and MySongs. If space is tight, consider stacking them or wrapping each in a collapsible <details> section.
• Firestore rules: the host’s userId is treated like any other player, so security rules based on proposedBy == request.auth.uid will still hold. Verify this if custom rules exist.
• Mobile layout: test on narrow screens; MySongs was previously never displayed there for hosts.

──────────────────────────────────────── B. Give the host an explicit list of players who are NOT ready ────────────────────────────────────────

Create a small presentational component, e.g. NotReadyList.tsx (same folder as PlayerList).
Props: { players: Record<string, Player> }.

Core logic:

const notReady = Object.values(players).filter(p => !p.isReady);
if (notReady.length === 0) return null;

return (
  <div className="not-ready-list">
    <h5>Waiting for:</h5>
    <ul>
      {notReady.map(p => <li key={p.id}>{p.name}</li>)}
    </ul>
  </div>
);
Insert it in Lobby.tsx, inside the “collecting_songs” branch, visible only to the host:

{isHost && lobby.status === 'collecting_songs' && (
  <NotReadyList players={lobby.players} />
)}
Styling (CSS) • Keep it compact; e.g. wrap in a semi-transparent box or badge style.
• Ensure it adapts to long player names (ellipsis or wrap).
• For >5 players consider a max-height with overflow-y: auto.

Potential pitfalls • Race conditions: Firestore updates are near-real-time, but UI may momentarily show a player as “waiting” after they click Ready. If this flicker matters, debounce the list for ~300 ms.
• Large lobbies: list size could blow up; add scroll or only show first N names plus “+k more”.
• Host readiness: the host themselves can appear in the not-ready list; that’s desirable because the game cannot start until every player (including host) is ready.

──────────────────────────────────────── C. Regression-test matrix ──────────────────────────────────────── ✓ Host adds a song → appears immediately under “My Songs”.
✓ Non-host behaviour unchanged.
✓ Host toggles Ready/Unready → disappears/appears in NotReadyList.
✓ Game start button remains disabled until NotReadyList is empty (logic already enforced by getAllPlayersReady()).

──────────────────────────────────────── D. Optional polish / backlog ──────────────────────────────────────── • Collapse “My Songs” by default for the host to reduce clutter.
• Inline readiness badges in PlayerList already exist; you can reuse their colour scheme for the new list for consistency.
• Persist host’s UI state (collapsed/expanded) in localStorage for better UX.

Follow these steps and the host will have full song-viewing capability and an at-a-glance view of who is still preparing, without disrupting existing player flows.

--- 4. mark as ready button has odd css - becomes very large after clicking

Detailed action-plan for “4. mark as ready button has odd css – becomes very large after clicking”

1 REPRO & ROOT-CAUSE
 a. Open DevTools, keep the element inspector pinned on the button.
 b. Click the button → watch the applied class list flip from not-ready ➜ loading ➜ ready.
 c. In the Computed-styles panel look for any property that suddenly jumps (width, padding, flex-basis, transform, outline, border, font-size, etc.).
  Typical culprits in this codebase:
  • global selector button { padding: 0.6em 1.2em; font-size: 1em; … } defined in index.css is more specific than .ready-button for properties not overwritten later; when the component swaps from .ready-button.not-ready to .ready-button.ready the cascade can briefly re-apply the global padding if the subclass rule is missing that property.
  • transition: all 0.2s ease; on .ready-button animates every CSS property; if the text length changes (“Mark Ready” ➜ “Ready!”) the browser can animate width ↑, giving the impression of a “jumbo” button.
  • Focus/outline rules (button:focus-visible { outline: 4px auto … }) may add 8 px each side, again inflating size.

2 CSS FIX
 a. Lock the geometry: give the element an explicit width so its size never depends on label length.

.ready-button{
  width: 8.5rem;      /* ≈136 px – pick a value that fits the longer label */
  box-sizing: border-box;
}
 b. Override global padding & font once, not per-state, so cascade cannot revert:

.ready-button,
.ready-button:disabled{       /* keep ↓ also when disabled */
  padding: .7rem 1.4rem;
  font-size: .875rem;
}
 c. Narrow the transition list to avoid animating width:

transition: background-color .2s ease, box-shadow .2s ease, transform .2s ease;
 d. Provide a persistent flex gap:

.ready-button.loading{ gap:0 }          /* no phantom gap when only spinner is present */
 e. Suppress the focus outline or move it inside so it does not enlarge box:

.ready-button:focus-visible{
  outline: none;
  box-shadow: 0 0 0 3px rgba(29,185,84,.6);
}
3 CODE CHANGES
 • Edit src/components/ReadyButton/ReadyButton.css with the rules above.
 • Remove the global padding line for .ready-button that duplicates the one in index.css, or keep but mark !important to beat the generic selector.
 • Optionally convert the component to CSS-modules or styled-components to escape global clashes entirely.

4 REGRESSION-GUARDS
 • Add a Jest/React-Testing-Library snapshot that clicks the button and asserts clientWidth stays unchanged.
 • Lighthouse “Layout Shift” metric should be ≤ 0.1 after interaction.
 • Visual-regression screenshot in CI (Percy or Storybook) for both states.

5 UNDERWATER STONES (hidden pitfalls)
 • Specificity wars – if another global stylesheet later in build overwrites width/padding, the bug reappears. Keep component styles last or use modules.
 • Different locale strings (e.g., “Готов!” / “Bereit!”) may overflow the fixed width; consider min-width+max-width instead of hard width.
 • Keyboard users still trigger :focus-visible; ensure you keep an accessible focus ring.
 • Mobile media-query (@media (max-width:640px) block) must also define the same width/padding or you will see the jump only on phones.
 • When isLoading spinner is shown the text nodes are removed; if spacing relies on them the button may collapse—keep min-width.
 • If you rely on Tailwind purge/treeshake, the new class names must be whitelisted so production build does not strip them.

Implementing the steps above stabilises the “Mark Ready” button size across all interaction states without sacrificing accessibility or visual polish.

--- 5. after host authenticating in Spotify - there is a red page for callback, showing:
Authentication Error

Missing code parameter

Redirecting to home page...
 but after redirect the user is logged in successfully

Need to remake the page so it would look like loading instead

 Why it happens
• The React component at /callback expects a query string field ?code=… but occasionally receives none, so it treats the request as a failure and shows the red screen.
• In reality the user’s cookie session is already created by the backend (or left over from an earlier attempt), so when the automatic redirect to ‘/’ fires, subsequent API calls appear authenticated – giving the impression of a “false-negative” error.

Implementation plan (concise but step-by-step)

A. Decide on one authoritative callback flow

Server-handled OAuth is usually simpler for React SPAs:
Front-end sends the user to BACKEND_URL/login.
Backend 302-redirects to Spotify with response_type=code (& PKCE if you want).
Spotify calls BACKEND_URL/callback (server endpoint, not React).
Backend exchanges the code, stores tokens (DB / Redis / signed cookie) and finally 302s the browser to FRONTEND_URL/after-auth?ok.
If you prefer a front-end callback (current approach) keep it, but treat “missing code” as a recoverable state instead of an error (details below). Pick only one of the two approaches and delete the other to avoid race conditions.
B. Front-end changes (when staying with a React /callback route)

In SpotifyCallback.tsx check BOTH window.location.search and window.location.hash.
const search = window.location.search;
const hash   = window.location.hash;           // e.g. #access_token=...
If you find access_token in the hash you are in Implicit-Grant, not Code-flow; parse it instead of throwing “Missing code”.
Parse the error query string coming back from Spotify (error=access_denied etc.) and show a useful message.
Only show the red error screen after the backend call returns an error or you determine no token of any kind is present. Until then keep the spinner.
Replace the hard-coded 3 s redirect with an explicit “Try again” button so users aren’t confused by the flash.
C. Backend changes (if you keep server-side flow)

Move all token exchange logic to an Express route /auth/callback.
Validate state to mitigate CSRF.
Store refresh_token in an HttpOnly SameSite=Strict cookie or in your DB keyed by user-id, not in localStorage.
Return a short-lived JWT or signed cookie indicating “spotifyLinked=true”.
Redirect to the SPA with either /lobby/:id or a plain “/” + query param so the front-end can resume flow.
D. Remove duplication
• If server does the exchange, the React component can be downgraded to a one-liner that just shows a loading spinner and waits for /api/me to return 200 OK.
• If React does the exchange, delete the unused Express callback to avoid confusion.

Potential “underwater stones”

Redirect URI mismatch
• The URI registered in the Spotify dashboard must exactly match what your app sends, including protocol (http/https), port, and trailing slash. Off-by-one slash produces Missing-code errors.

Mixed flows
• Mixing Implicit Grant and Authorization Code (with or without PKCE) leads to intermittent “missing code” because one flow returns ?code= while the other returns #access_token=.

Losing the PKCE verifier
• If you adopt Code + PKCE, the code_verifier must survive the round-trip. Store it in sessionStorage (not memory) before redirecting to Spotify.

CORS & cookies
• If backend and frontend run on different domains/ports, remember credentials: "include" in fetch and set Access-Control-Allow-Credentials: true on the server.
• Cookies that hold the session must be SameSite=None; Secure when using HTTPS with different sub-domains.

Timeouts
• A 10 s abort is OK locally but on slower networks can kill legitimate exchanges. Consider 15-30 s or back-off/retry logic.

Multiple tabs
• When several tabs go through OAuth simultaneously the “state” values differ; reject mismatching ones cleanly instead of clobbering the stored verifier.

Bookmark /callback
• Users may reload on the callback route without a query string. Treat this as “not authenticated” and immediately push to “/”.

Silent token refresh
• Add an endpoint (/auth/refresh) and a hook that refreshes the access token with the stored refresh_token before it expires; otherwise the first API call after 60 minutes will show a 401 and may trigger the red error page again.

Follow the chosen path above, remove the redundant flow, and the misleading red error flash should disappear while keeping authentication robust.


--- 6. After clicking ready - and then unready - start match button is still enabled

“After clicking Ready – and then Un-ready – the ‘Start Match’ (Start Game) button is still enabled”
Implementation guide:

Extend the Start-Game enablement logic
a. At the moment PlaylistStats.canStartGame() only checks playlist statistics:
– ≥ 2 songs overall
– ≥ 2 players have contributed songs.
It ignores every player’s isReady flag.
b. Compute “all players ready” in Lobby.tsx (already exists as getAllPlayersReady()).
c. Pass that boolean down to PlaylistStats as a new prop, e.g. allPlayersReady.
d. Change canStartGame() to return
playlistData.stats.totalSongs >= 2 && playlistData.stats.playersWithSongs >= 2 && props.allPlayersReady.

Wire the new prop

<PlaylistStats
    lobbyId={lobbyId!}
    allPlayersReady={getAllPlayersReady()}
    onStartGame={handleStartGameRequest}
/>
Update the component signature:

interface PlaylistStatsProps {
  lobbyId: string;
  allPlayersReady: boolean;
  onStartGame: () => void;
}
UI/UX adjustments
• In PlaylistStats, show a distinct “Waiting for all players to mark Ready” notice when !allPlayersReady.
• Disable the button (disabled attribute and greyed styling) whenever !canStartGame().

Keep backend validation (already present)
startGameWithPlaylist() throws if any player is un-ready. No server change is needed; the UI fix merely prevents confusing “button enabled -> error toast” flow.

Under-the-hood pitfalls (“underwater stones”):

• Race condition after a player un-readies: Firestore propagation is usually < 100 ms but the host might click before the state arrives. The backend will still reject, but ensure the error is surfaced clearly (setError → toast/snackbar) so users understand why the game didn’t start.

• Component re-render: The getAllPlayersReady() value must come from the same lobby snapshot used for display. Avoid storing it in local state; compute directly from the latest lobby prop to guarantee consistency.

• Host readiness: If the host also toggles Ready, be sure the Ready button for the host is visible (currently it is) so they can Un-ready too; otherwise the game might be blocked with no obvious way to fix.

• Player leaves lobby: When a ready player disconnects, players.length shrinks; getAllPlayersReady() should recompute and often remains true because the departed player is removed. Confirm this behavior fits your game rules (you may instead want to reset everybody to un-ready when membership changes).

• Minimum-player rule duplication: getAllPlayersReady() already checks players.length >= 2; keep that to match the playlist requirement, or unify the constants (e.g. put “MIN_PLAYERS” in a shared config).

• TypeScript breakage: Adding the new prop to PlaylistStats requires updating every existing usage (currently only in Lobby, but search tests as well). Run npm test/tsc to catch missed imports.

• Styling edge case: When the button toggles from enabled to disabled, its class list changes; make sure CSS doesn’t keep the “ready” visuals after disabling, and confirm focus outline is reset to avoid an accessibility glitch.

Following these steps will ensure the Start-Game button accurately reflects the current readiness state and prevent hosts from triggering a server-side error.


--- 7. Too many requests from backend when starting 2 games simultanously (one in progress other in lobby)

Once the 401 loop begins the React component keeps polling every second. After 100 requests in 15 minutes the global rate-limiter you set with express-rate-limit replies 429. Fixing the token storage will stop the 401s and the 429s disappear.
Next steps you might take
Patch the front-end as above and test one full game start to verify the field appears in Firestore and /currently-playing/… returns JSON.
Consider debouncing or back-off in the polling hook (e.g., stop polling for 30 s after a 401) to avoid hammering the server if a future auth error occurs.
Log an explicit warning in the front-end when the first 401 arrives so the host knows they need to re-link Spotify.




-- 8 In song selection dropdown double check if song is already selected
-- 9 in song selection whole song row should be clickable for add. if already added, the whole row should be greyed out