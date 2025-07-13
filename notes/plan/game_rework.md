High-level verdict
Having every browser poll /api/spotify/currently-playing/:lobbyId once a second works for demos but does not scale well (duplicate traffic, higher latency, harder rate-limit math).
A single server-side watcher per lobby is the cleanest, cheapest, and most secure design.
Only one request/second per lobby hits Spotify.
Guests simply subscribe to a Firestore document that the watcher updates.
You keep secrets and refresh-token logic entirely on the server.
Why Node/Express is fine (you do NOT need Spring Boot)
Polling = “make an async HTTP call every N seconds”. That is I/O-bound, not CPU-bound; Node’s event loop handles thousands of such timers easily.
You can spin up background jobs inside the same process (setInterval / node-cron) or in a separate worker process started by npm script or PM2.
If you later deploy multiple server instances behind a load-balancer you can use a lightweight distributed lock (e.g. Firestore document with a lease field or Redis) to ensure only one instance polls each lobby.
Sketch of the architecture
Apply to TrackInfo.ts...
status
Implementation outline in Node/Express (no code yet)
When the host calls POST /api/spotify/playlist or POST /game/:id/start, create a watcher:
Store { lobbyId, hostAccessToken, refreshToken, startedAt } in memory (or a DB).
setInterval every 1 000 ms:
Call GET https://api.spotify.com/v1/me/player/currently-playing.
If 401 → refresh token, retry, update Firestore.
Write the data to /games/{lobbyId}/state or directly to /lobbies/{id}.
When the game ends (status = finished) clear the interval and delete the watcher record.
Guests subscribe to /lobbies/{id} (or /games/{id}/state) and never call Spotify.
Handling many lobbies
Each active game = 1 interval + 1 in-flight HTTP request at a time → negligible memory.
1 000 simultaneous games = 1 000 requests/second to Spotify, but each under its own token → fits Spotify’s per-token limit (100 requests / 30 s).
If you outgrow a single Node instance, run a worker pool (ECS /Fargate, Cloud Run, etc.) with a “watcher ownership” flag in Firestore so only one worker polls a given lobby.
Why this is still “Express”
Express will keep serving HTTP APIs. The watchers are just JavaScript timers running in the same container or a sibling worker. You don’t gain anything by switching to Spring Boot unless your team is more comfortable in Java.
Security & reliability tips
Refresh tokens: store hostRefreshToken and auto-refresh when access token expires (~1 h).
Rate-limit safety: if Spotify responds 429, back-off according to Retry-After header.
Use a Firestore TTL on watcher metadata so orphaned watchers auto-clean if the server crashes.
Wrap each watcher loop in try/catch to prevent an unhandled rejection from crashing the process.
Keep your current HTTP endpoint as a fallback for debugging; disable it for guests in production.
Bottom line
Move the polling to the server; let clients read Firestore only.
Node/Express is perfectly adequate—just add a lightweight watcher manager or a small worker service.
You’ll cut network traffic, simplify the front-end, and stay well within Spotify’s limits even with many concurrent games.
Short answer
Polling once-per-second per lobby, using the host’s access-token, will not hit Spotify’s documented limits.
You must still obey Retry-After when Spotify replies 429 and you have to refresh the host’s token every ~60 min, but you won’t be “locked out” simply because of the 1 Hz polling cadence.
Detailed reasoning
Spotify’s public limits
Official guideline: ≤ 100 requests per 30 s per access-token (≈ 3.33 req/s).
The limit is enforced per Bearer token, not globally per app or per IP.
If you exceed it you get HTTP 429 with a Retry-After header (seconds).
Your planned load
1 request / second / lobby = 30 requests / 30 s → 30 < 100 → safe.
Each lobby has its own host token, so 1 000 concurrent lobbies = 1 000 req/s at the app level, but still only 1 req/s on any single token.
What could still trigger 429 / lockout
You accidentally reuse one service-account token for all lobbies.
You put the polling loop in the client, so five browser tabs per player = 5 req/s → 150 / 30 s → exceeds limit.
A bug causes tight-loop retry (e.g. on network error).
You ignore Retry-After and hammer again immediately.
Hardening checklist (server-side watcher)
One timer per lobby (store intervals in a Map<lobbyId, NodeJS.Timer>).
Wrap call in try/catch; on 429 read Retry-After → pause that lobby’s polling for that many seconds + 200 ms.
On HTTP 401 use the host’s refresh token to obtain a new access token and continue.
Clear the interval when lobby.status becomes finished or when no one is connected.
Keep an overall concurrency cap—e.g. p-limit with 50 parallel calls—to avoid spikes if many timers fire at the same millisecond.
Node/Express is still fine
Each poll is a non-blocking await axios.get(…); the event loop sleeps in between.
1 000 timers × 1 req/s = 1 000 inflight HTTP requests per second → peanuts for Node (typical throughput in the tens of thousands).
You can shard watchers across multiple instances later (e.g., one ECS/Fargate task per 300 lobbies) with a Firestore lease flag.
When to lower the frequency
If you approach 3 req/s on a single token because you decide to poll additional endpoints (queue, shuffle state, etc.).
For mobile data savings—many games choose 2 s or 3 s and interpolate progress client-side.
Spotify desktop/mobile clients themselves refresh /currently-playing roughly every second, so 1 Hz is “industry standard” for this endpoint.
Take-away
Stay with the 1 Hz server-side watcher per lobby; implement polite 429 back-off and token refresh, and you’ll stay well within Spotify’s limits—no need to switch frameworks or throttle more unless you add heavy extra API calls.

. Create a watcher manager module
1.1 src/watchers/trackWatcher.ts
exports startWatcher(lobbyId, hostAccessToken, hostRefreshToken)
exports stopWatcher(lobbyId)
maintains an internal Map<lobbyId, { timer, pauseUntil, accessToken, refreshToken }>
hard-cap max concurrent watchers (e.g. 500) – log & refuse if exceeded
1.2 All HTTP/Spotify calls use axios with 5 s timeout.
Wire it into an existing backend endpoint
In the POST /api/spotify/playlist handler (or a new POST /game/:id/start)
after the playlist is successfully created, call
watcherManager.startWatcher(lobbyId, accessToken, refreshToken)
store { hostAccessToken, hostRefreshToken } in Firestore for crash-recovery.
Watcher loop logic (runs every 1 000 ms unless paused)
3.1 GET https://api.spotify.com/v1/me/player/currently-playing
3.2 On success
write { isPlaying, trackUri, progressMs, updatedAt: serverTimestamp() } to
/lobbies/{id} (or /games/{id}/state)
3.3 On HTTP 401
refresh token via POST …/api/token
update accessToken in both memory & Firestore
3.4 On HTTP 429
read Retry-After → set pauseUntil = Date.now() + (retryAfterMs + 200)
3.5 On other errors → log, retry next tick.
3.6 Guard against host token re-use
key the Map by lobbyId; never start a watcher twice for the same lobby
include hostSpotifyUserId in the watcher state; if another lobby tries to start with the same token, reject with 409 Conflict and log a security warning.
4. Automatic shutdown
Firestore onSnapshot listener (or polling) watches /lobbies/{id}.status; when it becomes finished OR deleted, invoke stopWatcher.
stopWatcher clears interval, deletes the Map entry.
5. Crash-recovery & multi-instance guard (for future scale-out)
Create a document /watchers/{lobbyId} with { leaseUntil: timestamp, instanceId }
Each instance renews its lease every 30 s.
A new instance may steal the lease if leaseUntil < now().
(Add only the write/renew logic now; stealing can wait until scale-out.)
6. Environment / configuration
WATCHER_POLL_MS (default 1000)
WATCHER_MAX_CONCURRENCY (default 500)
WATCHER_DEFAULT_BACKOFF_MS (15000) – for network errors w/o Retry-After
Document them in README.md.
7. Firestore rules (nothing to do for Admin SDK)
Ensure client rules still forbid writes to isPlaying, trackUri, progressMs.
8. Metrics & logging (MVP)
Increment Prom-style counters in memory (success, 401-refresh, 429-backoff).
Expose /metrics in dev; production can integrate with Prometheus later.
9. Unit tests (Vitest)
Mock axios & Firestore; assert that
watcher starts only once per lobby
401 triggers refresh & continues
429 pauses loop for the correct duration.
10. Manual checklist before merging
☐ No references to VITE_SPOTIFY_CLIENT_SECRET in client bundle
☐ Front-end still calls /currently-playing (back compat) and works
☐ One watcher appears in server logs per started lobby
☐ Memory and handle counts remain stable during a 10-minute soak test with 50 lobbies.
Notes / pitfalls to avoid
Do NOT reuse one host token across lobbies – always pass the token received from that host’s cookie at game start.
Store both accessToken & refreshToken; never store client-secret in Firestore.
Respect Retry-After; otherwise Spotify will escalate from 429 to temporary IP ban.
Clean intervals on process SIGTERM to avoid orphan leases in Firestore.
Keep writes idempotent: only update fields that belong to playback state.
Once this phase is verified in production we will:
 – remove the browser polling code,
 – optionally move watcher code to a dedicated worker service or Cloud Run job,
 – add tests for 1 000 concurrent lobbies scale.



Long-term design (per game_rework.md)
The server-side watcher already writes
/lobbies/{lobbyId} → { isPlaying, trackUri, progressMs, updatedAt }.
Every browser (host and guests) can attach an onSnapshot listener to that
document; updates arrive in <100 ms and there is zero extra load on your
server or Spotify.
→ This is the preferred path for the modern client UI.
Why keep a REST endpoint at all?
Legacy / debugging: existing code that still fetches
/api/spotify/currently-playing/:lobbyId won’t break while you migrate the
front-end.
SSR or cron jobs that are outside Firebase SDK can still read playback
state without bundling Firestore client libraries.
So:
NEW front-end code should read Firestore directly (no HTTP round-trip).
The backend route is fine to keep during transition but can be marked
“deprecated” and eventually removed once all clients subscribe to Firestore.
If you keep both, just be sure the front-end doesn’t poll both paths; choose
one to avoid duplicate traffic.