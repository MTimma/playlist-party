# Music Guessing Game

A multiplayer music guessing game where players try to guess who added each song to the playlist. Similar to Jackbox games, this game requires only the host to have a Spotify Premium account.

## Features

- Create game lobbies and invite friends
- Add songs to a shared playlist
- Guess which player added each song
- Real-time score tracking
- Spotify integration for music playback

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Spotify Premium account (for the host)
- Firebase account
- Spotify Developer account

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd music-game
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
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

4. Set up Firebase:
   - Create a new Firebase project
   - Enable Realtime Database
   - Add your web app to the project
   - Copy the configuration values to your `.env` file

5. Set up Spotify:
   - Create a new app in the Spotify Developer Dashboard
   - Add `http://127.0.0.1:8888/callback` as a redirect URI
   - Copy the client ID and secret to your `.env` file

6. Start the development server:
```bash
npm run dev
```

## How to Play

1. The host creates a new game and shares the game link with friends
2. Players join the game by entering their names
3. Each player adds songs to the playlist
4. The host starts the game
5. For each song:
   - The song plays
   - Players guess who added it
   - Points are awarded for correct guesses
6. The player with the most points at the end wins!

## Technologies Used

- React
- TypeScript
- Vite
- Firebase Realtime Database
- Spotify Web API
- Tailwind CSS

## License

MIT
