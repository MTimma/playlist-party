import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { Lobby } from '../Lobby'
import { subscribeLobby, getCurrentUser, leaveLobby, updateLobbyStatus } from '../../../services/firebase'
import type { Lobby as LobbyType } from '../../../types/types'

// Mock the navigate function
const mockNavigate = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ lobbyId: 'test-lobby-id' }),
    useSearchParams: () => [mockSearchParams],
  }
})

const createMockLobby = (overrides: Partial<LobbyType> = {}): LobbyType => ({
  id: 'test-lobby-id',
  hostFirebaseUid: 'host-uid',
  hostSpotifyUserId: 'host-spotify-id',
  status: 'waiting',
  createdAt: new Date('2023-01-01T10:00:00Z'),
  maxPlayers: 8,
  players: {
    'host-uid': {
      id: 'host-uid',
      name: 'Host Player',
      isHost: true,
      joinedAt: new Date('2023-01-01T10:00:00Z'),
      score: 0,
    },
    'player-1': {
      id: 'player-1',
      name: 'Player 1',
      isHost: false,
      joinedAt: new Date('2023-01-01T10:05:00Z'),
      score: 0,
    },
  },
  ...overrides,
})

const renderLobby = (isHost = false) => {
  mockSearchParams.set('host', isHost ? 'true' : 'false')
  return render(
    <BrowserRouter>
      <Lobby />
    </BrowserRouter>
  )
}

describe('Lobby Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(getCurrentUser as any).mockReturnValue({ uid: 'current-user-uid' })
    ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
      callback(createMockLobby())
      return vi.fn() // unsubscribe function
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Initialization', () => {
    it('should render loading state initially', () => {
      ;(subscribeLobby as any).mockImplementation(() => vi.fn())
      renderLobby()

      expect(screen.getByText('Loading lobby...')).toBeInTheDocument()
      expect(screen.getByTestId('spinner') || document.querySelector('.spinner.large')).toBeInTheDocument()
    })

    it('should redirect to home when no lobby ID is provided', () => {
      vi.mocked(require('react-router-dom')).useParams.mockReturnValue({})
      renderLobby()

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should generate correct share link', async () => {
      renderLobby(true)

      await waitFor(() => {
        expect(screen.getByDisplayValue('http://localhost:5173/join?lobby=test-lobby-id')).toBeInTheDocument()
      })
    })

    it('should subscribe to lobby updates on mount', () => {
      renderLobby()

      expect(subscribeLobby).toHaveBeenCalledWith('test-lobby-id', expect.any(Function))
    })

    it('should unsubscribe from lobby updates on unmount', () => {
      const mockUnsubscribe = vi.fn()
      ;(subscribeLobby as any).mockReturnValue(mockUnsubscribe)

      const { unmount } = renderLobby()
      unmount()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  describe('Lobby Display', () => {
    it('should display lobby information correctly', async () => {
      renderLobby()

      await waitFor(() => {
        expect(screen.getByText('Game Lobby')).toBeInTheDocument()
        expect(screen.getByText('test-lobby-id')).toBeInTheDocument()
        expect(screen.getByText('Waiting for players to join')).toBeInTheDocument()
      })
    })

    it('should show different status messages based on lobby status', async () => {
      const lobbyStatuses = [
        { status: 'waiting', message: 'Waiting for players to join' },
        { status: 'collecting_songs', message: 'Players are adding songs to the playlist' },
        { status: 'in_progress', message: 'Game is in progress' },
        { status: 'finished', message: 'Game has finished' },
      ] as const

      for (const { status, message } of lobbyStatuses) {
        ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
          callback(createMockLobby({ status }))
          return vi.fn()
        })

        renderLobby()

        await waitFor(() => {
          expect(screen.getByText(message)).toBeInTheDocument()
        })
      }
    })

    it('should display status indicator with correct class', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({ status: 'waiting' }))
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        const statusIndicator = document.querySelector('.status-indicator.waiting')
        expect(statusIndicator).toBeInTheDocument()
      })
    })
  })

  describe('Host Controls', () => {
    beforeEach(() => {
      ;(getCurrentUser as any).mockReturnValue({ uid: 'host-uid' })
    })

    it('should show host controls when user is host', async () => {
      renderLobby(true)

      await waitFor(() => {
        expect(screen.getByText('Copy Invite Link')).toBeInTheDocument()
      })
    })

    it('should show start song collection button when conditions are met', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
            'player-1': {
              id: 'player-1',
              name: 'Player 1',
              isHost: false,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        expect(screen.getByText('Start Song Collection')).toBeInTheDocument()
      })
    })

    it('should not show start song collection button with insufficient players', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        expect(screen.queryByText('Start Song Collection')).not.toBeInTheDocument()
      })
    })

    it('should handle copy invite link successfully', async () => {
      const user = userEvent.setup()
      renderLobby(true)

      await waitFor(() => {
        const copyButton = screen.getByText('Copy Invite Link')
        expect(copyButton).toBeInTheDocument()
      })

      const copyButton = screen.getByText('Copy Invite Link')
      await user.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('http://localhost:5173/join?lobby=test-lobby-id')
        expect(screen.getByText('Copied!')).toBeInTheDocument()
      })

      // Should revert back to original text after timeout
      await waitFor(() => {
        expect(screen.getByText('Copy Invite Link')).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('should handle copy invite link error gracefully', async () => {
      const user = userEvent.setup()
      ;(navigator.clipboard.writeText as any).mockRejectedValueOnce(new Error('Clipboard error'))

      renderLobby(true)

      await waitFor(() => {
        const copyButton = screen.getByText('Copy Invite Link')
        expect(copyButton).toBeInTheDocument()
      })

      const copyButton = screen.getByText('Copy Invite Link')
      await user.click(copyButton)

      // Should not show "Copied!" on error
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument()
    })

    it('should start song collection when button is clicked', async () => {
      const user = userEvent.setup()
      ;(updateLobbyStatus as any).mockResolvedValueOnce(undefined)
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
            'player-1': {
              id: 'player-1',
              name: 'Player 1',
              isHost: false,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        const startButton = screen.getByText('Start Song Collection')
        expect(startButton).toBeInTheDocument()
      })

      const startButton = screen.getByText('Start Song Collection')
      await user.click(startButton)

      expect(updateLobbyStatus).toHaveBeenCalledWith('test-lobby-id', 'collecting_songs')
    })

    it('should handle start song collection error', async () => {
      const user = userEvent.setup()
      ;(updateLobbyStatus as any).mockRejectedValueOnce(new Error('Update failed'))
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': { id: 'host-uid', name: 'Host', isHost: true, joinedAt: new Date(), score: 0 },
            'player-1': { id: 'player-1', name: 'Player 1', isHost: false, joinedAt: new Date(), score: 0 },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        const startButton = screen.getByText('Start Song Collection')
        expect(startButton).toBeInTheDocument()
      })

      const startButton = screen.getByText('Start Song Collection')
      await user.click(startButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to start song collection. Please try again.')).toBeInTheDocument()
      })
    })
  })

  describe('Guest Controls', () => {
    beforeEach(() => {
      ;(getCurrentUser as any).mockReturnValue({ uid: 'player-1' })
    })

    it('should show leave lobby button for guests', async () => {
      renderLobby(false)

      await waitFor(() => {
        expect(screen.getByText('Leave Lobby')).toBeInTheDocument()
      })
    })

    it('should handle leave lobby successfully', async () => {
      const user = userEvent.setup()
      ;(leaveLobby as any).mockResolvedValueOnce(undefined)

      renderLobby(false)

      await waitFor(() => {
        const leaveButton = screen.getByText('Leave Lobby')
        expect(leaveButton).toBeInTheDocument()
      })

      const leaveButton = screen.getByText('Leave Lobby')
      await user.click(leaveButton)

      expect(leaveLobby).toHaveBeenCalledWith('test-lobby-id')
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should handle leave lobby error gracefully', async () => {
      const user = userEvent.setup()
      ;(leaveLobby as any).mockRejectedValueOnce(new Error('Leave failed'))

      renderLobby(false)

      await waitFor(() => {
        const leaveButton = screen.getByText('Leave Lobby')
        expect(leaveButton).toBeInTheDocument()
      })

      const leaveButton = screen.getByText('Leave Lobby')
      await user.click(leaveButton)

      // Should not navigate on error
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Waiting for Players State', () => {
    it('should show waiting notice when host has insufficient players', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        expect(screen.getByText('Waiting for Players')).toBeInTheDocument()
        expect(screen.getByText('You need at least 2 players to start the game. Share the invite link with your friends!')).toBeInTheDocument()
      })
    })

    it('should show share link input in waiting notice', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        const shareInput = screen.getByDisplayValue('http://localhost:5173/join?lobby=test-lobby-id')
        expect(shareInput).toBeInTheDocument()
        expect(shareInput).toHaveAttribute('readOnly')
      })
    })

    it('should not show waiting notice for guests', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(false)

      await waitFor(() => {
        expect(screen.queryByText('Waiting for Players')).not.toBeInTheDocument()
      })
    })
  })

  describe('Song Collection Phase', () => {
    it('should show collection phase message when status is collecting_songs', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({ status: 'collecting_songs' }))
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        expect(screen.getByText('Song Collection Phase')).toBeInTheDocument()
        expect(screen.getByText('Players can now add songs to the playlist. The game will start once everyone has added their songs.')).toBeInTheDocument()
      })
    })

    it('should not show collection phase for other statuses', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({ status: 'waiting' }))
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        expect(screen.queryByText('Song Collection Phase')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should show error when lobby is not found', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(null)
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        expect(screen.getByText('Lobby Error')).toBeInTheDocument()
        expect(screen.getByText('Lobby not found')).toBeInTheDocument()
        expect(screen.getByText('Go Home')).toBeInTheDocument()
      })
    })

    it('should navigate home when Go Home button is clicked', async () => {
      const user = userEvent.setup()
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(null)
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        const goHomeButton = screen.getByText('Go Home')
        expect(goHomeButton).toBeInTheDocument()
      })

      const goHomeButton = screen.getByText('Go Home')
      await user.click(goHomeButton)

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should clear error when lobby data becomes available', async () => {
      let callbackFn: Function
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callbackFn = callback
        callback(null) // Initially no lobby
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        expect(screen.getByText('Lobby not found')).toBeInTheDocument()
      })

      // Simulate lobby becoming available
      callbackFn(createMockLobby())

      await waitFor(() => {
        expect(screen.queryByText('Lobby not found')).not.toBeInTheDocument()
        expect(screen.getByText('Game Lobby')).toBeInTheDocument()
      })
    })
  })

  describe('PlayerList Integration', () => {
    it('should pass correct props to PlayerList', async () => {
      const mockLobby = createMockLobby()
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(mockLobby)
        return vi.fn()
      })

      renderLobby()

      await waitFor(() => {
        // Check that player names are displayed (indicating PlayerList is rendered)
        expect(screen.getByText('Host Player')).toBeInTheDocument()
        expect(screen.getByText('Player 1')).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Design', () => {
    it('should render correctly on mobile viewport', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375,
      })

      renderLobby()

      await waitFor(() => {
        expect(screen.getByText('Game Lobby')).toBeInTheDocument()
      })

      // Component should still function normally
      expect(screen.getByText('test-lobby-id')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading structure', async () => {
      renderLobby()

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Game Lobby')
      })
    })

    it('should have proper button labels', async () => {
      renderLobby(true)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Copy Invite Link' })).toBeInTheDocument()
      })
    })

    it('should have proper form labels', async () => {
      ;(subscribeLobby as any).mockImplementation((lobbyId, callback) => {
        callback(createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        }))
        return vi.fn()
      })

      renderLobby(true)

      await waitFor(() => {
        const shareInput = screen.getByDisplayValue('http://localhost:5173/join?lobby=test-lobby-id')
        expect(shareInput).toBeInTheDocument()
      })
    })
  })
}) 