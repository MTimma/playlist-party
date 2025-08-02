1. "Default rate limit is ~10 requests/sec; bulk usage requires approval."
We probably will not comply with this if more than 10 simultanous games are created
How should we proceed?

2. "Do not store Spotify Content (tracks, playlists, profile data) for more than 24 hours without refreshing via API." - we store playlists with song names etc. 
How should we fix this? I guess either clean up table or store only song url and fetch the names when necessary or store names locally (for added songs list for example)

3. "When a user disconnects, you must delete their personal data and tokens." are we doing this?


4. ""Advertising / monetisation
You cannot put Spotify Content behind a paywall or charge for it.
If your game shows ads, you need prior written approval.""

If we added some second game mode with more questions per song for some pay - would that count as putting Spotiy Content against paywall? The questions would be about song history, or singer history or facts.


5. """Branding / UX requirements
You must show a “Login with Spotify” button that follows their brand kit.
Any display of album art, artist name, etc., must preserve attribution.
Display “Powered by Spotify” or similar credit if you use their catalog data extensively.
Do not use “Spotify” in your app name or primary branding.
"""
are we doing this correctly?

6. """
what do we need for this?
Provide an in-app privacy policy describing what data you read, how long you keep it, and how to revoke.
"""

7. "require users to sign in with Premium."
how can we enforce this?

## Additional notes (2025-07-29)

> ⚠️ These notes are informational and do not constitute legal advice. Always verify against the latest Spotify Developer TOS/Policy.

### 1. Rate limit (~10 requests/second)
• Aggregate ALL outgoing Spotify requests on the server behind a token-bucket or leaky-bucket limiter (e.g. 10 req/s with burst 10).  
• Cache catalog responses (artist/album/track metadata) for ≤24 h and share across simultaneous games to reduce duplicate calls.  
• If projected traffic regularly exceeds 10 req/s, open a quota-increase request in the Spotify Dashboard or explore a Commercial Integration agreement.

### 2. 24-hour storage window
• Persist only the Spotify URI/ID in game tables.  
• Any descriptive metadata (name, artist, album art) should be fetched on demand or refreshed via a daily scheduled Cloud Function.  
• Add a 24-hour TTL policy/Firestore index so cached metadata auto-deletes.  
• On game end, purge the transient playlist copy immediately.

### 3. User disconnect = delete tokens
Current status TBD. Required steps:  
1. Provide a backend “/logout” route that deletes the user’s refresh + access tokens from storage *(implementation detail – we will need to add this)*.  
2. Optionally call Spotify’s token revocation endpoint.  
3. Clear the session cookie / Firebase custom token.  
4. Nightly sweeper job to remove tokens that are older than a threshold (e.g. 90 days).

### 4. Monetisation & paywalls
Charging for any feature whose value comes primarily from Spotify Content is considered a paywall and needs Spotify’s prior written approval. Extra game modes *about* the track (e.g. trivia) still derive their value from Spotify data, so **treat as paywall**. Safer options: sell cosmetics, generic hints, or non-Spotify trivia.

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
4. Web Playback SDK will also fail for non-Premium; enforce the same rule on the client for clarity.