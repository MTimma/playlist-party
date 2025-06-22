import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { JoinLobby } from '../../components/Player/JoinLobby'
import * as firebaseService from '../../services/firebase'

// Mock react-router-dom
const mockNavigate = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [mockSearchParams],
  }
})

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: true,
  spotifyUser: {
    id: 'test-spotify-user',
    display_name: 'Test Player',
    images: [{ url: 'https://example.com/avatar.jpg' }],
  },
  login: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

// Mock Firebase service
vi.mock('../../services/firebase', () => ({
  joinLobby: vi.fn(),
  getLobby: vi.fn(),
}))

describe('JoinLobby Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
    mockSearchParams.delete('lobbyId')
  })

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/lobby id/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /join lobby/i })).toBeInTheDocument()
    })

    it('should show Spotify user info when authenticated', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Test Player')).toBeInTheDocument()
    })
  })

  describe('URL Parameter Handling', () => {
    it('should pre-fill lobby ID from URL parameters', () => {
      mockSearchParams.set('lobbyId', 'test-lobby-123')

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText(/lobby id/i) as HTMLInputElement
      expect(lobbyIdInput.value).toBe('test-lobby-123')
    })

    it('should handle empty URL parameters gracefully', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText(/lobby id/i) as HTMLInputElement
      expect(lobbyIdInput.value).toBe('')
    })
  })

  describe('Authentication States', () => {
    it('should show login prompt when not authenticated', () => {
      const unauthenticatedContext = {
        ...mockAuthContext,
        isAuthenticated: false,
        spotifyUser: null,
      }

      vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(unauthenticatedContext)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByText(/connect to spotify/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /connect to spotify/i })).toBeInTheDocument()
    })

    it('should call login when connect button is clicked', async () => {
      const unauthenticatedContext = {
        ...mockAuthContext,
        isAuthenticated: false,
        spotifyUser: null,
      }

      vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(unauthenticatedContext)

      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const connectButton = screen.getByRole('button', { name: /connect to spotify/i })
      await user.click(connectButton)

      expect(unauthenticatedContext.login).toHaveBeenCalled()
    })
  })

  describe('Form Validation', () => {
    it('should require player name', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText(/lobby id/i)
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/name is required/i)).toBeInTheDocument()
      expect(firebaseService.joinLobby).not.toHaveBeenCalled()
    })

    it('should require lobby ID', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      await user.type(nameInput, 'Test Player')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/lobby id is required/i)).toBeInTheDocument()
      expect(firebaseService.joinLobby).not.toHaveBeenCalled()
    })

    it('should validate name length', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'a') // Too short
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/name must be at least 2 characters/i)).toBeInTheDocument()
    })

    it('should validate maximum name length', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'a'.repeat(21)) // Too long
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/name must be 20 characters or less/i)).toBeInTheDocument()
    })

    it('should validate lobby ID format', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'invalid-id') // Too short

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/lobby id must be at least 10 characters/i)).toBeInTheDocument()
    })
  })

  describe('Lobby Joining Process', () => {
    it('should join lobby with valid data', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(firebaseService.joinLobby).toHaveBeenCalledWith(
          'test-lobby-id',
          'Test Player'
        )
      })
    })

    it('should navigate to lobby after successful join', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/lobby/test-lobby-id')
      })
    })

    it('should show loading state during join', async () => {
      const user = userEvent.setup()
      let resolveJoin: () => void
      vi.mocked(firebaseService.joinLobby).mockImplementation(() => 
        new Promise(resolve => { resolveJoin = resolve })
      )

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      expect(screen.getByText(/joining lobby/i)).toBeInTheDocument()
      expect(joinButton).toBeDisabled()

      resolveJoin!()
      
      await waitFor(() => {
        expect(screen.queryByText(/joining lobby/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Scenarios', () => {
    it('should handle lobby not found error', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockRejectedValue(new Error('Lobby not found'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'invalid-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText(/lobby not found/i)).toBeInTheDocument()
      })

      expect(joinButton).not.toBeDisabled()
    })

    it('should handle lobby full error', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockRejectedValue(new Error('Lobby is full'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'full-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText(/lobby is full/i)).toBeInTheDocument()
      })
    })

    it('should handle network errors', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockRejectedValue(new Error('Network error'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })

    it('should clear error when retrying', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      
      // First attempt - should fail
      await user.click(joinButton)
      
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Second attempt - should succeed
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.queryByText(/network error/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/lobby id/i)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)
      const joinButton = screen.getByRole('button', { name: /join lobby/i })

      // Tab navigation
      await user.tab()
      expect(nameInput).toHaveFocus()

      await user.tab()
      expect(lobbyIdInput).toHaveFocus()

      await user.tab()
      expect(joinButton).toHaveFocus()
    })

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      const errorMessage = screen.getByText(/name is required/i)
      expect(errorMessage).toHaveAttribute('role', 'alert')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(undefined), 100))
      )

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      
      // Rapid clicks
      await user.click(joinButton)
      await user.click(joinButton)
      await user.click(joinButton)

      // Should only call joinLobby once
      await waitFor(() => {
        expect(firebaseService.joinLobby).toHaveBeenCalledTimes(1)
      })
    })

    it('should trim whitespace from input values', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, '  Test Player  ')
      await user.type(lobbyIdInput, '  test-lobby-id  ')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(firebaseService.joinLobby).toHaveBeenCalledWith(
          'test-lobby-id', // Should be trimmed
          'Test Player'    // Should be trimmed
        )
      })
    })

    it('should handle case-insensitive lobby IDs', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.joinLobby).mockResolvedValue(undefined)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your name/i)
      const lobbyIdInput = screen.getByLabelText(/lobby id/i)

      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'TEST-LOBBY-ID')

      const joinButton = screen.getByRole('button', { name: /join lobby/i })
      await user.click(joinButton)

      await waitFor(() => {
        expect(firebaseService.joinLobby).toHaveBeenCalledWith(
          'test-lobby-id', // Should be lowercase
          'Test Player'
        )
      })
    })
  })
}) 