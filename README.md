# Spotify Playlist Creation Companion App

A web-based companion that helps groups collaboratively build Spotify playlists remotely and turns the in-person listening session into a fun social guessing experience.

## Goal

To assist groups of people in creating collaborative playlists with added functionality and to enrich the social experience of discovering new music together. Playlist creation happens online, while the listening session ("play session") is intended to be enjoyed in person.

## Concept

1. **Lobby creation** – The host (a user with an active Spotify Premium subscription) creates a lobby and shares the invite link/code with friends.
2. **Playlist length selection** – The host specifies the desired total playlist length in minutes; the app automatically divides this time equally among all participants.
3. **Private song selection** – Each participant (including the host) searches Spotify and adds or removes tracks until they reach their individual minute limit. Selections remain hidden from others.
4. **Finalize playlist** – When everyone is satisfied, the host finalizes the playlist. The companion app then creates the playlist in the host’s Spotify account and shares the link with all players.
5. **In-person play session** – While the playlist is played through any Spotify client, the companion app opens a 30-second voting window at the start of every track so players can guess who added the song. An active internet connection is required for every participant.
6. **Story time** – After each vote, the person who contributed the track can share comments or stories about their choice.
7. **Post-session stats** – At the end of the playlist, the companion app displays statistics such as each participant’s correct-guess rate and other fun metrics.

## Features

- Create lobbies and invite friends with a shareable link or code
- Equal time allocation per participant based on the chosen playlist length
- Spotify search integration for adding/removing tracks
- One-click playlist finalization that creates the playlist in the host’s Spotify account
- 30-second in-person guessing game for every track
- Real-time vote collection and scoreboard
- Post-session statistics and leaderboard
- Only the host needs Spotify Premium; all other participants can use free accounts for song search and voting

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Spotify Premium account (host only)
- Firebase account
- Spotify Developer account

## Setup

1. **Clone the repository**

```bash
git clone <repository-url>
cd music-game
```

2. **Install dependencies**

```bash
npm install
```

3. **Environment variables** – Copy `.env.example` to `.env` (create the file if it does not exist) and provide the following values. *Never commit secrets to version control.*

```bash
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_DATABASE_URL=your_database_url
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id

# Spotify Configuration
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_CLIENT_SECRET=your_client_secret
VITE_SPOTIFY_REDIRECT_URI=http://localhost:5173/callback
```

4. **Firebase setup**
   - Create a new Firebase project.
   - Enable Realtime Database.
   - Add your web app to the project.
   - Copy the configuration values to your `.env` file.

5. **Spotify setup**
   - Create a new app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
   - Add `http://127.0.0.1:8888/callback` as a redirect URI.
   - Copy the client ID and secret to your `.env` file.

6. **Run the development server**

```bash
npm run dev
```

The app should now be available at `http://localhost:5173`.

## Quick Start (Using the Companion App)

1. The host opens the app, signs in with Spotify, creates a lobby, sets the total playlist length, and shares the lobby link.
2. Participants join the lobby, sign in with their Spotify account, and add tracks until they reach their individual minute limit.
3. When ready, the host finalizes the playlist; the app creates it on Spotify and reveals the listening link.
4. Gather in person, start playback in any Spotify client, and keep the companion app open for voting.
5. Vote on who added each track during the 30-second window, share stories, and enjoy the music!
6. Review the statistics page at the end of the playlist.

## Technologies Used

- React + TypeScript
- Vite
- Firebase Realtime Database
- Spotify Web API
- Tailwind CSS

---

**Security notice**: This project follows security best practices—API keys and secrets are sourced exclusively from environment variables and are never exposed in client-side code or committed to the repository. Please review and follow the setup instructions carefully to keep your credentials secure.
