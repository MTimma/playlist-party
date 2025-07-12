1. non-host players do not see their added songs or total added songs
2. host page is rendered by ?host=true parameter gives control to the game lobby. It should be inferred from host Spotify user session instead of URL flag which can be set by users.
3. mark as readay button has odd css - becomes very large after clicking
4. after host authenticating in Spotify - there is error page for callback but it disappears and host is logged in successfully
5. After clicking ready - and unready - start match button is still enabled

Player already in lobby


Once the 401 loop begins the React component keeps polling every second. After 100 requests in 15 minutes the global rate-limiter you set with express-rate-limit replies 429. Fixing the token storage will stop the 401s and the 429s disappear.
Next steps you might take
Patch the front-end as above and test one full game start to verify the field appears in Firestore and /currently-playing/… returns JSON.
Consider debouncing or back-off in the polling hook (e.g., stop polling for 30 s after a 401) to avoid hammering the server if a future auth error occurs.
Log an explicit warning in the front-end when the first 401 arrives so the host knows they need to re-link Spotify.