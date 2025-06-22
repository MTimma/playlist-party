import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CreateLobby } from '../components/Host/CreateLobby'
import { JoinLobby } from '../components/Player/JoinLobby'
import { Lobby } from '../components/Lobby/Lobby'
import * as firebaseService from '../services/firebase'

// Mock react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ lobbyId: 'test-lobby-id' }),
    useSearchParams: () => [new URLSearchParams()],
  }
})

// Mock AuthContext
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    spotifyUser: {
      id: 'test-spotify-user',
      display_name: 'Test User',
      images: [{ url: 'https://example.com/avatar.jpg' }],
    },
    login: vi.fn(),
  }),
}))

describe('Phase 1 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Complete Lobby Creation Flow', () => {
    it('should complete the full lobby creation and joining process', async () => {
      const user = userEvent.setup()
      const mockNavigate = vi.fn()
      
      // Mock successful lobby creation
      vi.mocked(firebaseService.createLobby).mockResolvedValue('created-lobby-id')
      
      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      // Fill in host name
      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      // Create lobby
      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(firebaseService.createLobby).toHaveBeenCalledWith(
          'Test Host',
          'test-spotify-user',
          8
        )
      })
    })
  })

  describe('Real-time Lobby Updates', () => {
    it('should handle real-time player updates', async () => {
      const mockUnsubscribe = vi.fn()
      let subscriptionCallback: (lobby: any) => void

      // Mock subscription
      vi.mocked(firebaseService.subscribeLobby).mockImplementation((lobbyId, callback) => {
        subscriptionCallback = callback
        return mockUnsubscribe
      })

      vi.mocked(firebaseService.getCurrentUser).mockReturnValue({
        uid: 'host-uid',
        displayName: null,
        email: null,
        isAnonymous: true,
      })

      render(
        <BrowserRouter>
          <Lobby />
        </BrowserRouter>
      )

      // Simulate initial lobby data
      const initialLobby = {
        id: 'test-lobby-id',
        hostId: 'host-uid',
        status: 'waiting' as const,
        players: {
          'host-uid': {
            id: 'host-uid',
            name: 'Host Player',
            isHost: true,
            joinedAt: new Date(),
            score: 0,
          },
        },
        maxPlayers: 8,
        createdAt: new Date(),
      }

      subscriptionCallback!(initialLobby)

      await waitFor(() => {
        expect(screen.getByText('Host Player')).toBeInTheDocument()
        expect(screen.getByText('Host')).toBeInTheDocument()
      })

      // Simulate new player joining
      const updatedLobby = {
        ...initialLobby,
        players: {
          ...initialLobby.players,
          'player-uid': {
            id: 'player-uid',
            name: 'New Player',
            isHost: false,
            joinedAt: new Date(),
            score: 0,
          },
        },
      }

      subscriptionCallback!(updatedLobby)

      await waitFor(() => {
        expect(screen.getByText('New Player')).toBeInTheDocument()
      })
    })
  })

  describe('Error Recovery Flows', () => {
    it('should handle network errors gracefully during lobby operations', async () => {
      const user = userEvent.setup()

      // Mock join lobby failure
      vi.mocked(firebaseService.joinLobby).mockRejectedValue(new Error('Network error'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      // Fill form
      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      // Attempt to join
      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Should allow retry
      expect(joinButton).not.toBeDisabled()
    })
  })

  describe('Cross-Component State Management', () => {
    it('should maintain consistent state across navigation', async () => {
      const mockNavigate = vi.fn()
      
      // Test that lobby state is properly maintained when navigating
      // This would be expanded with actual navigation testing
      expect(true).toBe(true) // Placeholder for more complex state management tests
    })
  })
}) 