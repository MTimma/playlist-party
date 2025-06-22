import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Lobby } from '../../components/Lobby/Lobby'
import * as firebaseService from '../../services/firebase'
import type { Lobby as LobbyType } from '../../types/types'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ lobbyId: 'test-lobby-id' }),
  }
})

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: true,
  spotifyUser: {
    id: 'current-user-id',
    display_name: 'Current User',
    images: [{ url: 'https://example.com/avatar.jpg' }],
  },
  login: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

// Mock Firebase service
vi.mock('../../services/firebase', () => ({
  subscribeLobby: vi.fn(),
  getCurrentUser: vi.fn(),
  leaveLobby: vi.fn(),
  startGame: vi.fn(),
  updateLobbyStatus: vi.fn(),
}))

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined),
  },
  writable: true,
})

describe('Lobby Component', () => {
  const mockLobby: LobbyType = {
    id: 'test-lobby-id',
    hostId: 'host-user-id',
    status: 'waiting',
    players: {
      'host-user-id': {
        id: 'host-user-id',
        name: 'Host Player',
        isHost: true,
        joinedAt: new Date('2023-01-01T10:00:00Z'),
        score: 0,
        avatarUrl: 'https://example.com/host-avatar.jpg',
      },
      'current-user-id': {
        id: 'current-user-id',
        name: 'Current User',
        isHost: false,
        joinedAt: new Date('2023-01-01T10:05:00Z'),
        score: 5,
        avatarUrl: 'https://example.com/current-avatar.jpg',
      },
    },
    maxPlayers: 8,
    createdAt: new Date('2023-01-01T10:00:00Z'),
  }

  const mockUnsubscribe = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    
    // Mock Firebase user
    vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
      uid: 'current-user-id',
      displayName: null,
      email: null,
      isAnonymous: true,
    })

    // Mock lobby subscription
    vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
      callback(mockLobby)
      return mockUnsubscribe
    })
  })

  describe('Rendering', () => {
    it('should render lobby information', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Lobby test-lobby-id')).toBeInTheDocument()
      expect(screen.getByText('2 / 8 players')).toBeInTheDocument()
    })

    it('should render player list', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Host Player')).toBeInTheDocument()
      expect(screen.getByText('Current User')).toBeInTheDocument()
    })

    it('should show waiting status', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Waiting for players')).toBeInTheDocument()
    })
  })

  describe('Host Controls', () => {
    beforeEach(() => {
      // Mock current user as host
      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      })
    })

    it('should show host controls when user is host', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByRole('button', { name: /start game/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /share lobby/i })).toBeInTheDocument()
    })

    it('should enable start game button when conditions are met', () => {
      const lobbyWithEnoughPlayers = {
        ...mockLobby,
        players: {
          ...mockLobby.players,
          'player-3': {
            id: 'player-3',
            name: 'Player Three',
            isHost: false,
            joinedAt: new Date(),
            score: 0,
          },
        },
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(lobbyWithEnoughPlayers)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const startButton = screen.getByRole('button', { name: /start game/i })
      expect(startButton).not.toBeDisabled()
    })

    it('should disable start game button with insufficient players', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const startButton = screen.getByRole('button', { name: /start game/i })
      expect(startButton).toBeDisabled()
    })

    it('should start game when start button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.startGame).mockResolvedValue(undefined)

      const lobbyWithEnoughPlayers = {
        ...mockLobby,
        players: {
          ...mockLobby.players,
          'player-3': {
            id: 'player-3',
            name: 'Player Three',
            isHost: false,
            joinedAt: new Date(),
            score: 0,
          },
        },
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(lobbyWithEnoughPlayers)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const startButton = screen.getByRole('button', { name: /start game/i })
      await user.click(startButton)

      expect(firebaseService.startGame).toHaveBeenCalledWith('test-lobby-id')
    })
  })

  describe('Guest Controls', () => {
    it('should show guest controls when user is not host', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByRole('button', { name: /leave lobby/i })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /start game/i })).not.toBeInTheDocument()
    })

    it('should leave lobby when leave button is clicked', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.leaveLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const leaveButton = screen.getByRole('button', { name: /leave lobby/i })
      await user.click(leaveButton)

      expect(firebaseService.leaveLobby).toHaveBeenCalledWith('test-lobby-id', 'current-user-id')
    })

    it('should navigate to home after leaving lobby', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.leaveLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const leaveButton = screen.getByRole('button', { name: /leave lobby/i })
      await user.click(leaveButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/')
      })
    })
  })

  describe('Share Functionality', () => {
    it('should copy share link to clipboard', async () => {
      const user = userEvent.setup()

      // Mock current user as host
      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const shareButton = screen.getByRole('button', { name: /share lobby/i })
      await user.click(shareButton)

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('test-lobby-id')
      )
    })

    it('should show success message after copying link', async () => {
      const user = userEvent.setup()

      // Mock current user as host
      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const shareButton = screen.getByRole('button', { name: /share lobby/i })
      await user.click(shareButton)

      await waitFor(() => {
        expect(screen.getByText(/link copied/i)).toBeInTheDocument()
      })
    })

    it('should handle clipboard error gracefully', async () => {
      const user = userEvent.setup()
      vi.mocked(navigator.clipboard.writeText).mockRejectedValue(new Error('Clipboard error'))

      // Mock current user as host
      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const shareButton = screen.getByRole('button', { name: /share lobby/i })
      await user.click(shareButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to copy link/i)).toBeInTheDocument()
      })
    })
  })

  describe('Real-time Updates', () => {
    it('should update when new players join', () => {
      let subscriptionCallback: (lobby: LobbyType) => void

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        subscriptionCallback = callback
        callback(mockLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      // Initial state
      expect(screen.getByText('2 / 8 players')).toBeInTheDocument()

      // Simulate new player joining
      const updatedLobby = {
        ...mockLobby,
        players: {
          ...mockLobby.players,
          'new-player': {
            id: 'new-player',
            name: 'New Player',
            isHost: false,
            joinedAt: new Date(),
            score: 0,
          },
        },
      }

      subscriptionCallback!(updatedLobby)

      expect(screen.getByText('3 / 8 players')).toBeInTheDocument()
      expect(screen.getByText('New Player')).toBeInTheDocument()
    })

    it('should update when players leave', () => {
      let subscriptionCallback: (lobby: LobbyType) => void

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        subscriptionCallback = callback
        callback(mockLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      // Initial state
      expect(screen.getByText('2 / 8 players')).toBeInTheDocument()
      expect(screen.getByText('Current User')).toBeInTheDocument()

      // Simulate player leaving
      const updatedLobby = {
        ...mockLobby,
        players: {
          'host-user-id': mockLobby.players['host-user-id'],
        },
      }

      subscriptionCallback!(updatedLobby)

      expect(screen.getByText('1 / 8 players')).toBeInTheDocument()
      expect(screen.queryByText('Current User')).not.toBeInTheDocument()
    })

    it('should unsubscribe on component unmount', () => {
      const { unmount } = render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Status Transitions', () => {
    it('should show collecting songs status', () => {
      const collectingLobby = {
        ...mockLobby,
        status: 'collecting_songs' as const,
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(collectingLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Collecting songs')).toBeInTheDocument()
    })

    it('should show in progress status', () => {
      const inProgressLobby = {
        ...mockLobby,
        status: 'in_progress' as const,
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(inProgressLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Game in progress')).toBeInTheDocument()
    })

    it('should show finished status', () => {
      const finishedLobby = {
        ...mockLobby,
        status: 'finished' as const,
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(finishedLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Game finished')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should handle lobby not found', () => {
      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(null)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Lobby not found')).toBeInTheDocument()
    })

    it('should handle subscription errors', () => {
      vi.mocked(firebaseService.subscribeLobby).mockImplementation(() => {
        throw new Error('Subscription failed')
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText(/error loading lobby/i)).toBeInTheDocument()
    })

    it('should handle leave lobby errors', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.leaveLobby).mockRejectedValue(new Error('Leave failed'))

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const leaveButton = screen.getByRole('button', { name: /leave lobby/i })
      await user.click(leaveButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to leave lobby/i)).toBeInTheDocument()
      })
    })

    it('should handle start game errors', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.startGame).mockRejectedValue(new Error('Start failed'))

      // Mock current user as host
      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      })

      const lobbyWithEnoughPlayers = {
        ...mockLobby,
        players: {
          ...mockLobby.players,
          'player-3': {
            id: 'player-3',
            name: 'Player Three',
            isHost: false,
            joinedAt: new Date(),
            score: 0,
          },
        },
      }

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        callback(lobbyWithEnoughPlayers)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const startButton = screen.getByRole('button', { name: /start game/i })
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to start game/i)).toBeInTheDocument()
      })
    })
  })

  describe('Loading States', () => {
    it('should show loading state initially', () => {
      vi.mocked(firebaseService.subscribeLobby).mockImplementation(() => {
        // Don't call callback immediately
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Loading lobby...')).toBeInTheDocument()
    })

    it('should show loading state during operations', async () => {
      const user = userEvent.setup()
      
      let resolveLeave: () => void
      vi.mocked(firebaseService.leaveLobby).mockImplementation(() => 
        new Promise(resolve => { resolveLeave = resolve })
      )

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const leaveButton = screen.getByRole('button', { name: /leave lobby/i })
      await user.click(leaveButton)

      expect(screen.getByText(/leaving lobby/i)).toBeInTheDocument()
      expect(leaveButton).toBeDisabled()

      resolveLeave!()
      
      await waitFor(() => {
        expect(screen.queryByText(/leaving lobby/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Lobby')
    })

    it('should announce status changes to screen readers', () => {
      let subscriptionCallback: (lobby: LobbyType) => void

      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        subscriptionCallback = callback
        callback(mockLobby)
        return mockUnsubscribe
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      // Change status
      const updatedLobby = {
        ...mockLobby,
        status: 'collecting_songs' as const,
      }

      subscriptionCallback!(updatedLobby)

      const statusElement = screen.getByText('Collecting songs')
      expect(statusElement).toHaveAttribute('aria-live', 'polite')
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      const leaveButton = screen.getByRole('button', { name: /leave lobby/i })
      
      await user.tab()
      expect(leaveButton).toHaveFocus()
    })
  })
}) 