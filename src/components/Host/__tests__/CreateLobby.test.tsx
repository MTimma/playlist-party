import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { CreateLobby } from '../CreateLobby'

// Mock Firebase service
vi.mock('../../../services/firebase', () => ({
  createLobby: vi.fn(),
  signInAnonymouslyIfNeeded: vi.fn(),
  getCurrentUser: vi.fn(),
}))

// Mock the navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// Mock fetch
global.fetch = vi.fn()

const renderCreateLobby = () => {
  return render(
    <BrowserRouter>
      <CreateLobby />
    </BrowserRouter>
  )
}

describe('CreateLobby Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication States', () => {
    it('should show Spotify login when not authenticated', async () => {
      // Mock unauthenticated state
      ;(global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ isAuthenticated: false }),
      })

      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByText('Create Game Lobby')).toBeInTheDocument()
        expect(
          screen.getByText('You need to connect your Spotify account to host a game')
        ).toBeInTheDocument()
        expect(screen.getByText('Connect Spotify Account')).toBeInTheDocument()
      })
    })

    it('should show create lobby form when authenticated', async () => {
      // Mock authenticated state
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            display_name: 'Test User',
            id: 'test-spotify-id',
            images: [{ url: 'test-avatar.jpg' }],
          }),
        })

      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByLabelText('Your Display Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Maximum Players')).toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Create Lobby' })).toBeInTheDocument()
      })
    })

    it('should handle authentication check error gracefully', async () => {
      // Mock network error
      ;(global.fetch as any).mockRejectedValueOnce(new Error('Network error'))

      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByText('Connect Spotify Account')).toBeInTheDocument()
      })
    })
  })

  describe('Spotify Login', () => {
    it('should redirect to Spotify login when button is clicked', async () => {
      ;(global.fetch as any).mockResolvedValueOnce({
        json: () => Promise.resolve({ isAuthenticated: false }),
      })

      // Mock window.location.href
      delete (window as any).location
      ;(window as any).location = { href: '' }

      renderCreateLobby()

      await waitFor(() => {
        const loginButton = screen.getByText('Connect Spotify Account')
        fireEvent.click(loginButton)
        expect(window.location.href).toBe('http://localhost:3000/login')
      })
    })
  })

  describe('Lobby Creation Form', () => {
    beforeEach(async () => {
      // Setup authenticated state
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            display_name: 'Test User',
            id: 'test-spotify-id',
            images: [{ url: 'test-avatar.jpg' }],
          }),
        })
    })

    it('should render form elements correctly', async () => {
      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByLabelText('Your Display Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Maximum Players')).toBeInTheDocument()
        expect(screen.getByDisplayValue('Test User')).toBeInTheDocument()
        expect(screen.getByDisplayValue('8')).toBeInTheDocument()
      })
    })

    it('should show host profile information', async () => {
      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByText('Welcome, Test User!')).toBeInTheDocument()
        expect(screen.getByText("You'll be hosting this game")).toBeInTheDocument()
        expect(screen.getByAltText('Host profile')).toBeInTheDocument()
      })
    })

    it('should allow changing display name', async () => {
      const user = userEvent.setup()
      renderCreateLobby()

      await waitFor(() => {
        const nameInput = screen.getByLabelText('Your Display Name')
        expect(nameInput).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Your Display Name')
      await user.clear(nameInput)
      await user.type(nameInput, 'New Host Name')

      expect(nameInput).toHaveValue('New Host Name')
    })

    it('should allow changing max players', async () => {
      const user = userEvent.setup()
      renderCreateLobby()

      await waitFor(() => {
        const maxPlayersSelect = screen.getByLabelText('Maximum Players')
        expect(maxPlayersSelect).toBeInTheDocument()
      })

      const maxPlayersSelect = screen.getByLabelText('Maximum Players')
      await user.selectOptions(maxPlayersSelect, '6')

      expect(maxPlayersSelect).toHaveValue('6')
    })

    it('should disable create button when name is empty', async () => {
      const user = userEvent.setup()
      renderCreateLobby()

      await waitFor(() => {
        const nameInput = screen.getByLabelText('Your Display Name')
        expect(nameInput).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Your Display Name')
      const createButton = screen.getByRole('button', { name: 'Create Lobby' })

      await user.clear(nameInput)

      expect(createButton).toBeDisabled()
    })
  })

  describe('Lobby Creation Process', () => {
    beforeEach(async () => {
      // Setup authenticated state
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            display_name: 'Test User',
            id: 'test-spotify-id',
            images: [{ url: 'test-avatar.jpg' }],
          }),
        })
    })

    it('should create lobby successfully and navigate', async () => {
      const user = userEvent.setup()
      ;(createLobby as any).mockResolvedValueOnce('test-lobby-id')

      renderCreateLobby()

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: 'Create Lobby' })
        expect(createButton).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: 'Create Lobby' })
      await user.click(createButton)

      await waitFor(() => {
        expect(createLobby).toHaveBeenCalledWith('Test User', 'test-spotify-id', 8)
        expect(mockNavigate).toHaveBeenCalledWith('/lobby/test-lobby-id')
      })
    })

    it('should show loading state during creation', async () => {
      const user = userEvent.setup()
      ;(createLobby as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve('test-lobby-id'), 100))
      )

      renderCreateLobby()

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: 'Create Lobby' })
        expect(createButton).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: 'Create Lobby' })
      await user.click(createButton)

      expect(screen.getByText('Creating Lobby...')).toBeInTheDocument()
      expect(createButton).toBeDisabled()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    it('should handle lobby creation error', async () => {
      const user = userEvent.setup()
      ;(createLobby as any).mockRejectedValueOnce(new Error('Failed to create lobby'))

      renderCreateLobby()

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: 'Create Lobby' })
        expect(createButton).toBeInTheDocument()
      })

      const createButton = screen.getByRole('button', { name: 'Create Lobby' })
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to create lobby. Please try again.')).toBeInTheDocument()
        expect(createButton).not.toBeDisabled()
      })
    })

    it('should validate required fields before creation', async () => {
      const user = userEvent.setup()
      renderCreateLobby()

      await waitFor(() => {
        const nameInput = screen.getByLabelText('Your Display Name')
        expect(nameInput).toBeInTheDocument()
      })

      const nameInput = screen.getByLabelText('Your Display Name')
      const createButton = screen.getByRole('button', { name: 'Create Lobby' })

      // Clear the name field
      await user.clear(nameInput)
      await user.click(createButton)

      await waitFor(() => {
        expect(screen.getByText('Please ensure you are logged in and have entered a name')).toBeInTheDocument()
      })

      expect(createLobby).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    beforeEach(async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve({
            display_name: 'Test User',
            id: 'test-spotify-id',
          }),
        })
    })

    it('should have proper labels for form elements', async () => {
      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByLabelText('Your Display Name')).toBeInTheDocument()
        expect(screen.getByLabelText('Maximum Players')).toBeInTheDocument()
      })
    })

    it('should have proper button roles and names', async () => {
      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Create Lobby' })).toBeInTheDocument()
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing Spotify user data', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockResolvedValueOnce({
          json: () => Promise.resolve(null),
        })

      renderCreateLobby()

      await waitFor(() => {
        const nameInput = screen.getByLabelText('Your Display Name')
        expect(nameInput).toHaveValue('')
      })
    })

    it('should handle Spotify user fetch error', async () => {
      ;(global.fetch as any)
        .mockResolvedValueOnce({
          json: () => Promise.resolve({ isAuthenticated: true }),
        })
        .mockRejectedValueOnce(new Error('Spotify API error'))

      renderCreateLobby()

      await waitFor(() => {
        expect(screen.getByLabelText('Your Display Name')).toBeInTheDocument()
      })
    })
  })
}) 