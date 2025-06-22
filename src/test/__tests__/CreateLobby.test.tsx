import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CreateLobby } from '../../components/Host/CreateLobby'
import * as firebaseService from '../../services/firebase'

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: true,
  spotifyUser: {
    id: 'test-spotify-user',
    display_name: 'Test User',
    images: [{ url: 'https://example.com/avatar.jpg' }],
  },
  login: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

// Mock Firebase service
vi.mock('../../services/firebase', () => ({
  createLobby: vi.fn(),
}))

describe('CreateLobby Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  describe('Rendering', () => {
    it('should render the form with all required fields', () => {
      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/your display name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/maximum players/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /create lobby/i })).toBeInTheDocument()
    })

    it('should have default values set correctly', () => {
      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const maxPlayersInput = screen.getByLabelText(/maximum players/i) as HTMLInputElement
      expect(maxPlayersInput.value).toBe('8')
    })

    it('should show Spotify user info when authenticated', () => {
      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      expect(screen.getByText('Test User')).toBeInTheDocument()
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
          <CreateLobby />
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
          <CreateLobby />
        </BrowserRouter>
      )

      const connectButton = screen.getByRole('button', { name: /connect to spotify/i })
      await user.click(connectButton)

      expect(unauthenticatedContext.login).toHaveBeenCalled()
    })
  })

  describe('Form Validation', () => {
    it('should require display name', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/display name is required/i)).toBeInTheDocument()
      expect(firebaseService.createLobby).not.toHaveBeenCalled()
    })

    it('should validate display name length', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'a') // Too short

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/display name must be at least 2 characters/i)).toBeInTheDocument()
    })

    it('should validate maximum length for display name', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'a'.repeat(21)) // Too long

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/display name must be 20 characters or less/i)).toBeInTheDocument()
    })

    it('should validate max players range', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      const maxPlayersInput = screen.getByLabelText(/maximum players/i)

      await user.type(nameInput, 'Test Host')
      await user.clear(maxPlayersInput)
      await user.type(maxPlayersInput, '1') // Too low

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/minimum 2 players required/i)).toBeInTheDocument()
    })

    it('should validate max players upper limit', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      const maxPlayersInput = screen.getByLabelText(/maximum players/i)

      await user.type(nameInput, 'Test Host')
      await user.clear(maxPlayersInput)
      await user.type(maxPlayersInput, '21') // Too high

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/maximum 20 players allowed/i)).toBeInTheDocument()
    })
  })

  describe('Lobby Creation Process', () => {
    it('should create lobby with valid data', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby).mockResolvedValue('test-lobby-id')

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

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

    it('should navigate to lobby after successful creation', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby).mockResolvedValue('test-lobby-id')

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/lobby/test-lobby-id')
      })
    })

    it('should show loading state during creation', async () => {
      const user = userEvent.setup()
      let resolveCreate: (value: string) => void
      vi.mocked(firebaseService.createLobby).mockImplementation(() => 
        new Promise(resolve => { resolveCreate = resolve })
      )

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      expect(screen.getByText(/creating lobby/i)).toBeInTheDocument()
      expect(createButton).toBeDisabled()

      resolveCreate!('test-lobby-id')
      
      await waitFor(() => {
        expect(screen.queryByText(/creating lobby/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message on creation failure', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby).mockRejectedValue(new Error('Creation failed'))

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText(/creation failed/i)).toBeInTheDocument()
      })

      expect(createButton).not.toBeDisabled()
    })

    it('should clear error when retrying', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby)
        .mockRejectedValueOnce(new Error('Creation failed'))
        .mockResolvedValue('test-lobby-id')

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      
      // First attempt - should fail
      await user.click(createButton)
      
      await waitFor(() => {
        expect(screen.getByText(/creation failed/i)).toBeInTheDocument()
      })

      // Second attempt - should succeed
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.queryByText(/creation failed/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Accessibility', () => {
    it('should have proper form labels', () => {
      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      expect(screen.getByLabelText(/your display name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/maximum players/i)).toBeInTheDocument()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      const maxPlayersInput = screen.getByLabelText(/maximum players/i)
      const createButton = screen.getByRole('button', { name: /create lobby/i })

      // Tab navigation
      await user.tab()
      expect(nameInput).toHaveFocus()

      await user.tab()
      expect(maxPlayersInput).toHaveFocus()

      await user.tab()
      expect(createButton).toHaveFocus()
    })

    it('should announce errors to screen readers', async () => {
      const user = userEvent.setup()

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      const errorMessage = screen.getByText(/display name is required/i)
      expect(errorMessage).toHaveAttribute('role', 'alert')
    })
  })

  describe('Edge Cases', () => {
    it('should handle rapid form submissions', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve('test-lobby-id'), 100))
      )

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, 'Test Host')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      
      // Rapid clicks
      await user.click(createButton)
      await user.click(createButton)
      await user.click(createButton)

      // Should only call createLobby once
      await waitFor(() => {
        expect(firebaseService.createLobby).toHaveBeenCalledTimes(1)
      })
    })

    it('should trim whitespace from input values', async () => {
      const user = userEvent.setup()
      vi.mocked(firebaseService.createLobby).mockResolvedValue('test-lobby-id')

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText(/your display name/i)
      await user.type(nameInput, '  Test Host  ')

      const createButton = screen.getByRole('button', { name: /create lobby/i })
      await user.click(createButton)

      await waitFor(() => {
        expect(firebaseService.createLobby).toHaveBeenCalledWith(
          'Test Host', // Should be trimmed
          'test-spotify-user',
          8
        )
      })
    })

    it('should handle missing Spotify user gracefully', () => {
      const contextWithoutSpotify = {
        ...mockAuthContext,
        spotifyUser: null,
      }

      vi.mocked(require('../../contexts/AuthContext').useAuth).mockReturnValue(contextWithoutSpotify)

      render(
        <BrowserRouter>
          <CreateLobby />
        </BrowserRouter>
      )

      expect(screen.getByText(/spotify account required/i)).toBeInTheDocument()
    })
  })
}) 