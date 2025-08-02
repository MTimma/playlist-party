1. "Default rate limit is ~10 requests/sec; bulk usage requires approval."
a. When creating game in UI, need to check active games and not allow new game if more than 5 active. We have watcher limits but this should be UI change also in the best case. Currently we can reduce watcher limit to physically not surpass Spotify requirement. 
For a graceful user-level error, add a similar check in your lobby-creation endpoint (/api/game/:lobbyId/host-token or wherever the game starts) and return 429 or 503.

b. Also need to double check Firestore rules so user cannot call it directly to create new game etc

2. Need to clean up Lobby and Playlist after games are ended or are not active.
Node-cron inside the same service (quick & simple)
import cron from "node-cron";
   cron.schedule("0 * * * *", async () => {   // hourly
     await purgeExpiredCache();               // delete >24 h metadata
   });
OR 
Use Firebase Scheduled Cloud Functions / Cloud Scheduler
More reliable in multi-instance or auto-scaling scenarios.
The function would call an admin endpoint (or run Firestore queries directly) to delete documents where cachedAt < now-24h.
Either way, the clean-up code only touches your own Firestore documents; it never downloads the whole Spotify catalogue.

### 3. User disconnect = delete tokens
Current status TBD. Required steps:  
1. Provide a backend “/logout” route that deletes the user’s refresh + access tokens from storage *(implementation detail – we will need to add this)*.  
2. Optionally call Spotify’s token revocation endpoint.  
3. Clear the session cookie / Firebase custom token.  
4. Nightly sweeper job to remove tokens that are older than a threshold (e.g. 90 days).



### 5. Branding / UX checklist
☑ Use the official “Continue with Spotify” button asset.  
☑ Show album art + track/artist text with proper attribution (“Cover art © Spotify”).  
☑ Display “Powered by Spotify” in footer or game lobby.  
☑ Ensure the app name/URL/logo do **not** contain “Spotify”.  
→ Action: run a UI audit before public release.

### 6. Privacy policy
Add a `/privacy` route (frontend) and static `/privacy.html` on the server. Must include:  
• What data/scopes we request (`user-read-email`, playlists, etc.).  
• Retention window (24 h for metadata, tokens until user revokes).  
• How to request deletion (account settings → “Delete my data”).  
• Contact e-mail for data-protection queries.

### 7. Requiring Premium
1. During OAuth, request `user-read-private`; the `/me` response includes "product": "premium" | "free".  
2. After successful auth, check that field server-side.  
3. If not premium, respond with a 403 and show a modal instructing the user to upgrade.  
4. Web Playback SDK will also fail for non-Premium; enforce the same rule on the client for