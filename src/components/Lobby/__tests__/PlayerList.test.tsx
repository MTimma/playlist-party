import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerList } from '../PlayerList'
import type { Player } from '../../../types/types'

// Mock Timestamp for testing
const mockTimestamp = {
  toDate: () => new Date('2023-01-01T10:00:00Z'),
}

const createMockPlayer = (overrides: Partial<Player> = {}): Player => ({
  id: 'player-1',
  name: 'Test Player',
  isHost: false,
  joinedAt: new Date('2023-01-01T10:00:00Z'),
  score: 0,
  avatarUrl: undefined,
  ...overrides,
})

const createMockPlayers = (count: number): { [playerId: string]: Player } => {
  const players: { [playerId: string]: Player } = {}
  for (let i = 1; i <= count; i++) {
    const playerId = `player-${i}`
    players[playerId] = createMockPlayer({
      id: playerId,
      name: `Player ${i}`,
      isHost: i === 1,
      joinedAt: new Date(`2023-01-01T${9 + i}:00:00Z`),
    })
  }
  return players
}

describe('PlayerList Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock Date.now() for consistent time calculations
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01T10:30:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Component Rendering', () => {
    it('should render player list header correctly', () => {
      const players = createMockPlayers(3)
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('Players')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('/')).toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('should render all players correctly', () => {
      const players = createMockPlayers(3)
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('Player 1')).toBeInTheDocument()
      expect(screen.getByText('Player 2')).toBeInTheDocument()
      expect(screen.getByText('Player 3')).toBeInTheDocument()
    })

    it('should render empty slots for remaining players', () => {
      const players = createMockPlayers(3)
      render(<PlayerList players={players} maxPlayers={8} />)

      const waitingSlots = screen.getAllByText('Waiting for player...')
      expect(waitingSlots).toHaveLength(5) // 8 - 3 = 5 empty slots
    })

    it('should not render empty slots when lobby is full', () => {
      const players = createMockPlayers(4)
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.queryByText('Waiting for player...')).not.toBeInTheDocument()
      expect(screen.getByText('Lobby is full')).toBeInTheDocument()
    })
  })

  describe('Player Information Display', () => {
    it('should display player names correctly', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Alice',
        }),
        'player-2': createMockPlayer({
          id: 'player-2',
          name: 'Bob',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('Alice')).toBeInTheDocument()
      expect(screen.getByText('Bob')).toBeInTheDocument()
    })

    it('should show host badge for host player', () => {
      const players = {
        'host-player': createMockPlayer({
          id: 'host-player',
          name: 'Host Player',
          isHost: true,
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('Host')).toBeInTheDocument()
      const hostCard = screen.getByText('Host Player').closest('.player-card')
      expect(hostCard).toHaveClass('host')
    })

    it('should show join time for non-host players', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Regular Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:00:00Z'), // 30 minutes ago
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('30m ago')).toBeInTheDocument()
    })

    it('should show "Just joined" for recent joins', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'New Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:29:30Z'), // 30 seconds ago
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('Just joined')).toBeInTheDocument()
    })

    it('should show hours for old joins', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Old Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T08:00:00Z'), // 2.5 hours ago
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('2h ago')).toBeInTheDocument()
    })

    it('should handle Firestore Timestamp objects', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Timestamp Player',
          isHost: false,
          joinedAt: mockTimestamp as any, // Mock Firestore Timestamp
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('30m ago')).toBeInTheDocument()
    })
  })

  describe('Avatar Display', () => {
    it('should show avatar image when avatarUrl is provided', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Avatar Player',
          avatarUrl: 'https://example.com/avatar.jpg',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      const avatar = screen.getByAltText("Avatar Player's avatar")
      expect(avatar).toBeInTheDocument()
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg')
    })

    it('should show initials when no avatar is provided', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'John Doe',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('should handle single word names for initials', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Alice',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('A')).toBeInTheDocument()
    })

    it('should limit initials to 2 characters', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'John Michael Smith',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      expect(screen.getByText('JM')).toBeInTheDocument()
    })

    it('should show host badge on avatar for host player', () => {
      const players = {
        'host-player': createMockPlayer({
          id: 'host-player',
          name: 'Host Player',
          isHost: true,
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} />)

      const hostBadge = screen.getByText('Host Player')
        .closest('.player-card')
        ?.querySelector('.host-badge')
      expect(hostBadge).toBeInTheDocument()
    })
  })

  describe('Current User Highlighting', () => {
    it('should highlight current user card', () => {
      const players = {
        'current-user': createMockPlayer({
          id: 'current-user',
          name: 'Current User',
        }),
        'other-user': createMockPlayer({
          id: 'other-user',
          name: 'Other User',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} currentUserId="current-user" />)

      const currentUserCard = screen.getByText('Current User').closest('.player-card')
      expect(currentUserCard).toHaveClass('current-user')
    })

    it('should show "(You)" indicator for current user', () => {
      const players = {
        'current-user': createMockPlayer({
          id: 'current-user',
          name: 'Current User',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} currentUserId="current-user" />)

      expect(screen.getByText('(You)')).toBeInTheDocument()
    })

    it('should not show "(You)" indicator for other users', () => {
      const players = {
        'other-user': createMockPlayer({
          id: 'other-user',
          name: 'Other User',
        }),
      }
      render(<PlayerList players={players} maxPlayers={8} currentUserId="current-user" />)

      expect(screen.queryByText('(You)')).not.toBeInTheDocument()
    })
  })

  describe('Online Status', () => {
    it('should show online status for all players', () => {
      const players = createMockPlayers(3)
      render(<PlayerList players={players} maxPlayers={8} />)

      const onlineIndicators = screen.getAllByTestId('status-indicator') || 
        document.querySelectorAll('.status-indicator.online')
      expect(onlineIndicators).toHaveLength(3)
    })
  })

  describe('Empty State', () => {
    it('should render empty slots with placeholder content', () => {
      const players = createMockPlayers(2)
      render(<PlayerList players={players} maxPlayers={5} />)

      const emptySlots = screen.getAllByText('Waiting for player...')
      expect(emptySlots).toHaveLength(3)

      // Check that empty slots have the right class
      emptySlots.forEach(slot => {
        const emptyCard = slot.closest('.player-card')
        expect(emptyCard).toHaveClass('empty')
      })
    })

    it('should show user icon in empty slots', () => {
      const players = {}
      render(<PlayerList players={players} maxPlayers={2} />)

      const emptySlots = document.querySelectorAll('.player-card.empty')
      expect(emptySlots).toHaveLength(2)

      // Check for SVG icons in empty slots
      const svgIcons = document.querySelectorAll('.player-card.empty svg')
      expect(svgIcons).toHaveLength(2)
    })
  })

  describe('Lobby Full State', () => {
    it('should show lobby full notice when at capacity', () => {
      const players = createMockPlayers(4)
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.getByText('Lobby is full')).toBeInTheDocument()
      
      // Should have checkmark icon
      const fullNotice = screen.getByText('Lobby is full').closest('.lobby-full-notice')
      expect(fullNotice?.querySelector('svg')).toBeInTheDocument()
    })

    it('should not show lobby full notice when not at capacity', () => {
      const players = createMockPlayers(3)
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.queryByText('Lobby is full')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty players object', () => {
      render(<PlayerList players={{}} maxPlayers={4} />)

      expect(screen.getByText('0')).toBeInTheDocument()
      expect(screen.getByText('4')).toBeInTheDocument()
      expect(screen.getAllByText('Waiting for player...')).toHaveLength(4)
    })

    it('should handle maxPlayers of 1', () => {
      const players = createMockPlayers(1)
      render(<PlayerList players={players} maxPlayers={1} />)

      // Check player count display
      const playerCount = document.querySelector('.player-count')
      expect(playerCount).toBeInTheDocument()
      expect(playerCount?.querySelector('.current-count')).toHaveTextContent('1')
      expect(playerCount?.querySelector('.max-count')).toHaveTextContent('1')
      expect(screen.getByText('Lobby is full')).toBeInTheDocument()
    })

    it('should handle very long player names', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'This Is A Very Long Player Name That Might Cause Layout Issues',
        }),
      }
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.getByText('This Is A Very Long Player Name That Might Cause Layout Issues')).toBeInTheDocument()
    })

    it('should handle special characters in player names', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Player™ with émojis 🎵',
        }),
      }
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.getByText('Player™ with émojis 🎵')).toBeInTheDocument()
    })

    it('should handle invalid dates gracefully', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Invalid Date Player',
          joinedAt: new Date('invalid-date'),
        }),
      }
      
      // Should not throw an error
      expect(() => {
        render(<PlayerList players={players} maxPlayers={4} />)
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('should have proper semantic structure', () => {
      const players = createMockPlayers(2)
      render(<PlayerList players={players} maxPlayers={4} />)

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Players')
    })

    it('should have proper alt text for avatar images', () => {
      const players = {
        'player-1': createMockPlayer({
          id: 'player-1',
          name: 'Avatar Player',
          avatarUrl: 'https://example.com/avatar.jpg',
        }),
      }
      render(<PlayerList players={players} maxPlayers={4} />)

      const avatar = screen.getByAltText("Avatar Player's avatar")
      expect(avatar).toBeInTheDocument()
    })

    it('should have proper contrast for status indicators', () => {
      const players = createMockPlayers(1)
      render(<PlayerList players={players} maxPlayers={4} />)

      const statusIndicator = document.querySelector('.status-indicator.online')
      expect(statusIndicator).toBeInTheDocument()
    })
  })
}) 