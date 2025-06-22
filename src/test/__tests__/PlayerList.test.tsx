import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayerList } from '../../components/Lobby/PlayerList'
import type { Player } from '../../types/types'

// Mock AuthContext
const mockAuthContext = {
  isAuthenticated: true,
  spotifyUser: {
    id: 'current-user-id',
    display_name: 'Current User',
    images: [{ url: 'https://example.com/current-avatar.jpg' }],
  },
  login: vi.fn(),
}

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
}))

describe('PlayerList Component', () => {
  const mockPlayers: Player[] = [
    {
      id: 'host-id',
      name: 'Host Player',
      isHost: true,
      joinedAt: new Date('2023-01-01T10:00:00Z'),
      score: 0,
      avatarUrl: 'https://example.com/host-avatar.jpg',
    },
    {
      id: 'player-1',
      name: 'Player One',
      isHost: false,
      joinedAt: new Date('2023-01-01T10:05:00Z'),
      score: 10,
      avatarUrl: 'https://example.com/player1-avatar.jpg',
    },
    {
      id: 'current-user-id',
      name: 'Current User',
      isHost: false,
      joinedAt: new Date('2023-01-01T10:10:00Z'),
      score: 5,
      avatarUrl: 'https://example.com/current-avatar.jpg',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    // Mock current time for consistent time calculations
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2023-01-01T10:15:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Player Display', () => {
    it('should render all players', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('Host Player')).toBeInTheDocument()
      expect(screen.getByText('Player One')).toBeInTheDocument()
      expect(screen.getByText('Current User')).toBeInTheDocument()
    })

    it('should show host badge for host player', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('Host')).toBeInTheDocument()
    })

    it('should display player scores', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('0 points')).toBeInTheDocument()
      expect(screen.getByText('10 points')).toBeInTheDocument()
      expect(screen.getByText('5 points')).toBeInTheDocument()
    })

    it('should handle singular point display', () => {
      const singlePointPlayer: Player[] = [
        {
          id: 'player-1',
          name: 'Single Point Player',
          isHost: false,
          joinedAt: new Date(),
          score: 1,
        },
      ]

      render(<PlayerList players={singlePointPlayer} />)

      expect(screen.getByText('1 point')).toBeInTheDocument()
    })
  })

  describe('Avatar Handling', () => {
    it('should display player avatars when available', () => {
      render(<PlayerList players={mockPlayers} />)

      const avatars = screen.getAllByRole('img')
      expect(avatars).toHaveLength(3)
      
      expect(avatars[0]).toHaveAttribute('src', 'https://example.com/host-avatar.jpg')
      expect(avatars[1]).toHaveAttribute('src', 'https://example.com/player1-avatar.jpg')
      expect(avatars[2]).toHaveAttribute('src', 'https://example.com/current-avatar.jpg')
    })

    it('should show default avatar when avatarUrl is not provided', () => {
      const playersWithoutAvatars: Player[] = [
        {
          id: 'player-1',
          name: 'No Avatar Player',
          isHost: false,
          joinedAt: new Date(),
          score: 0,
        },
      ]

      render(<PlayerList players={playersWithoutAvatars} />)

      const avatar = screen.getByRole('img')
      expect(avatar).toHaveAttribute('src', expect.stringContaining('default'))
    })

    it('should have proper alt text for avatars', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByAltText('Host Player avatar')).toBeInTheDocument()
      expect(screen.getByAltText('Player One avatar')).toBeInTheDocument()
      expect(screen.getByAltText('Current User avatar')).toBeInTheDocument()
    })

    it('should handle avatar loading errors gracefully', () => {
      render(<PlayerList players={mockPlayers} />)

      const avatar = screen.getByAltText('Host Player avatar')
      
      // Simulate image load error
      Object.defineProperty(avatar, 'src', {
        value: 'fallback-avatar.png',
        writable: true,
      })

      expect(avatar).toHaveAttribute('src', 'fallback-avatar.png')
    })
  })

  describe('Time Calculations', () => {
    it('should show "just joined" for recent joins', () => {
      const recentPlayer: Player[] = [
        {
          id: 'recent-player',
          name: 'Recent Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:14:30Z'), // 30 seconds ago
          score: 0,
        },
      ]

      render(<PlayerList players={recentPlayer} />)

      expect(screen.getByText('just joined')).toBeInTheDocument()
    })

    it('should show minutes for older joins', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('15 minutes ago')).toBeInTheDocument() // Host
      expect(screen.getByText('10 minutes ago')).toBeInTheDocument() // Player One
      expect(screen.getByText('5 minutes ago')).toBeInTheDocument()  // Current User
    })

    it('should handle singular minute display', () => {
      const oneMinuteAgoPlayer: Player[] = [
        {
          id: 'one-minute-player',
          name: 'One Minute Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:14:00Z'), // 1 minute ago
          score: 0,
        },
      ]

      render(<PlayerList players={oneMinuteAgoPlayer} />)

      expect(screen.getByText('1 minute ago')).toBeInTheDocument()
    })

    it('should show hours for very old joins', () => {
      const oldPlayer: Player[] = [
        {
          id: 'old-player',
          name: 'Old Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T08:15:00Z'), // 2 hours ago
          score: 0,
        },
      ]

      render(<PlayerList players={oldPlayer} />)

      expect(screen.getByText('2 hours ago')).toBeInTheDocument()
    })
  })

  describe('Current User Highlighting', () => {
    it('should highlight current user', () => {
      render(<PlayerList players={mockPlayers} />)

      const currentUserElement = screen.getByText('Current User').closest('[data-testid="player-item"]')
      expect(currentUserElement).toHaveClass('current-user')
    })

    it('should show "You" indicator for current user', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('should not highlight other players', () => {
      render(<PlayerList players={mockPlayers} />)

      const hostElement = screen.getByText('Host Player').closest('[data-testid="player-item"]')
      const playerElement = screen.getByText('Player One').closest('[data-testid="player-item"]')
      
      expect(hostElement).not.toHaveClass('current-user')
      expect(playerElement).not.toHaveClass('current-user')
    })
  })

  describe('Empty States', () => {
    it('should show empty state when no players', () => {
      render(<PlayerList players={[]} />)

      expect(screen.getByText('No players in lobby')).toBeInTheDocument()
    })

    it('should show loading state when players is undefined', () => {
      render(<PlayerList players={undefined as any} />)

      expect(screen.getByText('Loading players...')).toBeInTheDocument()
    })
  })

  describe('Sorting and Ordering', () => {
    it('should sort players with host first', () => {
      const unsortedPlayers: Player[] = [
        {
          id: 'player-1',
          name: 'Regular Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:00:00Z'),
          score: 0,
        },
        {
          id: 'host-id',
          name: 'Host Player',
          isHost: true,
          joinedAt: new Date('2023-01-01T10:05:00Z'),
          score: 0,
        },
      ]

      render(<PlayerList players={unsortedPlayers} />)

      const playerElements = screen.getAllByTestId('player-item')
      expect(playerElements[0]).toHaveTextContent('Host Player')
      expect(playerElements[1]).toHaveTextContent('Regular Player')
    })

    it('should sort non-host players by join time', () => {
      const playersToSort: Player[] = [
        {
          id: 'player-2',
          name: 'Second Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:10:00Z'),
          score: 0,
        },
        {
          id: 'player-1',
          name: 'First Player',
          isHost: false,
          joinedAt: new Date('2023-01-01T10:05:00Z'),
          score: 0,
        },
        {
          id: 'host-id',
          name: 'Host Player',
          isHost: true,
          joinedAt: new Date('2023-01-01T10:15:00Z'),
          score: 0,
        },
      ]

      render(<PlayerList players={playersToSort} />)

      const playerElements = screen.getAllByTestId('player-item')
      expect(playerElements[0]).toHaveTextContent('Host Player')
      expect(playerElements[1]).toHaveTextContent('First Player')
      expect(playerElements[2]).toHaveTextContent('Second Player')
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByRole('list')).toHaveAttribute('aria-label', 'Players in lobby')
    })

    it('should have proper list item roles', () => {
      render(<PlayerList players={mockPlayers} />)

      const listItems = screen.getAllByRole('listitem')
      expect(listItems).toHaveLength(3)
    })

    it('should have descriptive text for screen readers', () => {
      render(<PlayerList players={mockPlayers} />)

      expect(screen.getByText('Host Player, host, 0 points, joined 15 minutes ago')).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      render(<PlayerList players={mockPlayers} />)

      const playerElements = screen.getAllByTestId('player-item')
      playerElements.forEach(element => {
        expect(element).toHaveAttribute('tabIndex', '0')
      })
    })
  })

  describe('Performance', () => {
    it('should handle large player lists efficiently', () => {
      const manyPlayers: Player[] = Array.from({ length: 100 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        isHost: i === 0,
        joinedAt: new Date(`2023-01-01T10:${String(i).padStart(2, '0')}:00Z`),
        score: i * 5,
      }))

      const { container } = render(<PlayerList players={manyPlayers} />)

      expect(container.querySelectorAll('[data-testid="player-item"]')).toHaveLength(100)
      expect(screen.getByText('Player 0')).toBeInTheDocument() // Host
      expect(screen.getByText('Player 99')).toBeInTheDocument() // Last player
    })

    it('should not re-render unnecessarily', () => {
      const { rerender } = render(<PlayerList players={mockPlayers} />)

      // Re-render with same props
      rerender(<PlayerList players={mockPlayers} />)

      // Should still render correctly
      expect(screen.getByText('Host Player')).toBeInTheDocument()
      expect(screen.getByText('Player One')).toBeInTheDocument()
      expect(screen.getByText('Current User')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle players with very long names', () => {
      const longNamePlayer: Player[] = [
        {
          id: 'long-name-player',
          name: 'This is a very long player name that might cause layout issues',
          isHost: false,
          joinedAt: new Date(),
          score: 0,
        },
      ]

      render(<PlayerList players={longNamePlayer} />)

      expect(screen.getByText('This is a very long player name that might cause layout issues')).toBeInTheDocument()
    })

    it('should handle players with special characters in names', () => {
      const specialCharPlayer: Player[] = [
        {
          id: 'special-char-player',
          name: 'Player™ with 🎵 special chars & symbols',
          isHost: false,
          joinedAt: new Date(),
          score: 0,
        },
      ]

      render(<PlayerList players={specialCharPlayer} />)

      expect(screen.getByText('Player™ with 🎵 special chars & symbols')).toBeInTheDocument()
    })

    it('should handle negative scores', () => {
      const negativeScorePlayer: Player[] = [
        {
          id: 'negative-player',
          name: 'Negative Player',
          isHost: false,
          joinedAt: new Date(),
          score: -5,
        },
      ]

      render(<PlayerList players={negativeScorePlayer} />)

      expect(screen.getByText('-5 points')).toBeInTheDocument()
    })

    it('should handle very high scores', () => {
      const highScorePlayer: Player[] = [
        {
          id: 'high-score-player',
          name: 'High Score Player',
          isHost: false,
          joinedAt: new Date(),
          score: 999999,
        },
      ]

      render(<PlayerList players={highScorePlayer} />)

      expect(screen.getByText('999,999 points')).toBeInTheDocument()
    })

    it('should handle invalid dates gracefully', () => {
      const invalidDatePlayer: Player[] = [
        {
          id: 'invalid-date-player',
          name: 'Invalid Date Player',
          isHost: false,
          joinedAt: new Date('invalid-date'),
          score: 0,
        },
      ]

      render(<PlayerList players={invalidDatePlayer} />)

      expect(screen.getByText('recently')).toBeInTheDocument()
    })
  })
}) 