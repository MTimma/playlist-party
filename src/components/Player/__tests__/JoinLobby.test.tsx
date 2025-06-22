import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { JoinLobby } from '../JoinLobby'
import { joinLobby } from '../../../services/firebase'

// Mock the navigate function
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams('lobby=test-lobby-id')],
  }
})

const renderJoinLobby = (searchParams = '') => {
  // Mock useSearchParams based on test needs
  vi.mocked(vi.importActual('react-router-dom')).useSearchParams = () => [
    new URLSearchParams(searchParams)
  ]
  
  return render(
    <BrowserRouter>
      <JoinLobby />
    </BrowserRouter>
  )
}

describe('JoinLobby Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Component Rendering', () => {
    it('should render join lobby form correctly', () => {
      renderJoinLobby()

      expect(screen.getByText('Join Game Lobby')).toBeInTheDocument()
      expect(screen.getByText('Enter the lobby details to join the music guessing game')).toBeInTheDocument()
      expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Lobby ID')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Join Lobby' })).toBeInTheDocument()
    })

    it('should show alternative action to create lobby', () => {
      renderJoinLobby()

      expect(screen.getByText('Want to host a game instead?')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Lobby' })).toBeInTheDocument()
    })

    it('should show no Spotify required message', () => {
      renderJoinLobby()

      expect(screen.getByText('No Spotify account required to join as a player')).toBeInTheDocument()
    })
  })

  describe('URL Parameter Handling', () => {
    it('should pre-fill lobby ID from URL parameter', () => {
      // Mock useSearchParams to return lobby parameter
      const mockSearchParams = new URLSearchParams('lobby=url-lobby-id')
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [mockSearchParams],
        }
      })

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByDisplayValue('url-lobby-id')).toBeInTheDocument()
      expect(screen.getByText('Lobby ID provided from invitation link')).toBeInTheDocument()
    })

    it('should disable lobby ID input when provided via URL', () => {
      const mockSearchParams = new URLSearchParams('lobby=url-lobby-id')
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [mockSearchParams],
        }
      })

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      expect(lobbyIdInput).toBeDisabled()
    })
  })

  describe('Form Validation', () => {
    beforeEach(() => {
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [new URLSearchParams()],
        }
      })
    })

    it('should disable join button when name is empty', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      expect(joinButton).toBeDisabled()
    })

    it('should disable join button when lobby ID is empty', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      await user.type(nameInput, 'Test Player')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      expect(joinButton).toBeDisabled()
    })

    it('should enable join button when both fields are filled', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      expect(joinButton).not.toBeDisabled()
    })

    it('should show error when trying to join with empty name', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      await user.type(lobbyIdInput, 'test-lobby-id')

      // Try to join with empty name (should not be possible due to disabled button)
      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      expect(joinButton).toBeDisabled()
    })

    it('should trim whitespace from inputs', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockResolvedValueOnce(true)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, '  Test Player  ')
      await user.type(lobbyIdInput, '  test-lobby-id  ')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(joinLobby).toHaveBeenCalledWith('test-lobby-id', 'Test Player')
      })
    })
  })

  describe('Form Interactions', () => {
    beforeEach(() => {
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [new URLSearchParams()],
        }
      })
    })

    it('should allow typing in name field', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      await user.type(nameInput, 'Test Player')

      expect(nameInput).toHaveValue('Test Player')
    })

    it('should allow typing in lobby ID field', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      await user.type(lobbyIdInput, 'test-lobby-123')

      expect(lobbyIdInput).toHaveValue('test-lobby-123')
    })

    it('should limit name input to 30 characters', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const longName = 'A'.repeat(35)
      await user.type(nameInput, longName)

      expect(nameInput).toHaveAttribute('maxLength', '30')
    })

    it('should handle Enter key press to join lobby', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockResolvedValueOnce(true)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')
      await user.keyboard('{Enter}')

      await waitFor(() => {
        expect(joinLobby).toHaveBeenCalledWith('test-lobby-id', 'Test Player')
      })
    })
  })

  describe('Lobby Joining Process', () => {
    beforeEach(() => {
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [new URLSearchParams()],
        }
      })
    })

    it('should join lobby successfully and navigate', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockResolvedValueOnce(true)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(joinLobby).toHaveBeenCalledWith('test-lobby-id', 'Test Player')
        expect(mockNavigate).toHaveBeenCalledWith('/lobby/test-lobby-id')
      })
    })

    it('should show loading state during join process', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      )

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      expect(screen.getByText('Joining Lobby...')).toBeInTheDocument()
      expect(joinButton).toBeDisabled()

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled()
      })
    })

    it('should disable all inputs during join process', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      )

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      const createButton = screen.getByRole('button', { name: 'Create Lobby' })
      
      await user.click(joinButton)

      expect(nameInput).toBeDisabled()
      expect(lobbyIdInput).toBeDisabled()
      expect(joinButton).toBeDisabled()
      expect(createButton).toBeDisabled()
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [new URLSearchParams()],
        }
      })
    })

    it('should handle lobby not found error', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockRejectedValueOnce(new Error('Lobby not found'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'invalid-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText('Lobby not found')).toBeInTheDocument()
        expect(joinButton).not.toBeDisabled()
      })
    })

    it('should handle lobby full error', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockRejectedValueOnce(new Error('Lobby is full'))

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'full-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText('Lobby is full')).toBeInTheDocument()
      })
    })

    it('should handle generic error with fallback message', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any).mockRejectedValueOnce(new Error())

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'test-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText('Failed to join lobby. Please check the lobby ID and try again.')).toBeInTheDocument()
      })
    })

    it('should clear error when retrying', async () => {
      const user = userEvent.setup()
      ;(joinLobby as any)
        .mockRejectedValueOnce(new Error('Lobby not found'))
        .mockResolvedValueOnce(true)

      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      const lobbyIdInput = screen.getByLabelText('Lobby ID')
      
      await user.type(nameInput, 'Test Player')
      await user.type(lobbyIdInput, 'invalid-lobby-id')

      const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.getByText('Lobby not found')).toBeInTheDocument()
      })

      // Clear and retry with valid lobby ID
      await user.clear(lobbyIdInput)
      await user.type(lobbyIdInput, 'valid-lobby-id')
      await user.click(joinButton)

      await waitFor(() => {
        expect(screen.queryByText('Lobby not found')).not.toBeInTheDocument()
        expect(mockNavigate).toHaveBeenCalledWith('/lobby/valid-lobby-id')
      })
    })
  })

  describe('Navigation', () => {
    beforeEach(() => {
      vi.doMock('react-router-dom', async () => {
        const actual = await vi.importActual('react-router-dom')
        return {
          ...actual,
          useNavigate: () => mockNavigate,
          useSearchParams: () => [new URLSearchParams()],
        }
      })
    })

    it('should navigate to create lobby when button is clicked', async () => {
      const user = userEvent.setup()
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const createButton = screen.getByRole('button', { name: 'Create Lobby' })
      await user.click(createButton)

      expect(mockNavigate).toHaveBeenCalledWith('/create')
    })
  })

  describe('Accessibility', () => {
    it('should have proper labels for form elements', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
      expect(screen.getByLabelText('Lobby ID')).toBeInTheDocument()
    })

    it('should have proper button roles and names', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      expect(screen.getByRole('button', { name: 'Join Lobby' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Create Lobby' })).toBeInTheDocument()
    })

    it('should have autofocus on name input', () => {
      render(
        <BrowserRouter>
          <JoinLobby />
        </BrowserRouter>
      )

      const nameInput = screen.getByLabelText('Your Name')
      expect(nameInput).toHaveAttribute('autoFocus')
    })
  })
}) 