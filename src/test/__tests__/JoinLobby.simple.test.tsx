import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BrowserRouter } from 'react-router-dom'
import { JoinLobby } from '../../components/Player/JoinLobby'

// Mock the firebase service
vi.mock('../../services/firebase', () => ({
  joinLobby: vi.fn(),
}))

// Mock react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useSearchParams: () => [new URLSearchParams()],
  }
})

describe('JoinLobby Component - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockNavigate.mockClear()
  })

  it('should render the component', () => {
    render(
      <BrowserRouter>
        <JoinLobby />
      </BrowserRouter>
    )

    expect(screen.getByText('Join Game Lobby')).toBeInTheDocument()
    expect(screen.getByLabelText('Your Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Lobby ID')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Join Lobby' })).toBeInTheDocument()
  })

  it('should disable join button when fields are empty', () => {
    render(
      <BrowserRouter>
        <JoinLobby />
      </BrowserRouter>
    )

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
    const joinButton = screen.getByRole('button', { name: 'Join Lobby' })

    await user.type(nameInput, 'Test Player')
    await user.type(lobbyIdInput, 'test-lobby-id')

    expect(joinButton).not.toBeDisabled()
  })

  it('should show error when name is empty', async () => {
    const user = userEvent.setup()
    
    render(
      <BrowserRouter>
        <JoinLobby />
      </BrowserRouter>
    )

    const lobbyIdInput = screen.getByLabelText('Lobby ID')
    await user.type(lobbyIdInput, 'test-lobby-id')

    // Try to join without name (button should be disabled)
    const joinButton = screen.getByRole('button', { name: 'Join Lobby' })
    expect(joinButton).toBeDisabled()
  })

  it('should navigate to create lobby page', async () => {
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

  it('should handle keyboard enter to join', async () => {
    const user = userEvent.setup()
    const mockJoinLobby = vi.mocked(await import('../../services/firebase')).joinLobby
    mockJoinLobby.mockResolvedValue(undefined)
    
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
      expect(mockJoinLobby).toHaveBeenCalledWith('test-lobby-id', 'Test Player')
    })
  })
}) 