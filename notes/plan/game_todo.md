Todos for Game.tsx

1. Need to filter out if playing song is from the lobby playlist
   
   **Technical Requirements:**
   - Add validation in Game.tsx to check if currentTrack.uri exists in playlistCollection.songs
   - Implement the following logic when receiving track updates from Firebase:
     ```typescript
     // In the lobby subscription useEffect
     if (lobbyData.currentTrack) {
       const trackUri = lobbyData.currentTrack.uri;
       const isFromLobbyPlaylist = playlistCollection?.songs?.[trackUri] !== undefined;
       
       if (!isFromLobbyPlaylist) {
         // Track is not from lobby playlist - don't show it
         setCurrentTrack(null);
         setIsPlaying(false);
         // Optionally show a message to the host
         return;
       }
     }
     ```
   - Consider adding a visual indicator when the host is playing a song not from the game playlist
   - Add error handling for edge cases (e.g., playlistCollection not loaded yet)
   - Optional: Add server-side validation in trackWatcher.ts to prevent non-playlist tracks from being stored
     - Check against the playlist tracks before updating Firestore
     - Add playlistId to the watcher state for validation
   
2. Need to populate buttons
3. Need to initialize and keep score

