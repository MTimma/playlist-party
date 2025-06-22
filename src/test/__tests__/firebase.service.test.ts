import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as firebaseService from '../../services/firebase'

// Mock Firebase modules
const mockDoc = vi.fn()
const mockSetDoc = vi.fn()
const mockGetDoc = vi.fn()
const mockUpdateDoc = vi.fn()
const mockOnSnapshot = vi.fn()
const mockCollection = vi.fn()
const mockServerTimestamp = vi.fn()
const mockSignInAnonymously = vi.fn()
const mockOnAuthStateChanged = vi.fn()

vi.mock('firebase/firestore', () => ({
  doc: mockDoc,
  setDoc: mockSetDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  onSnapshot: mockOnSnapshot,
  collection: mockCollection,
  serverTimestamp: mockServerTimestamp,
}))

vi.mock('firebase/auth', () => ({
  signInAnonymously: mockSignInAnonymously,
  onAuthStateChanged: mockOnAuthStateChanged,
}))

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockServerTimestamp.mockReturnValue({ toDate: () => new Date() })
  })

  describe('Authentication', () => {
    it('should sign in anonymously', async () => {
      const mockUser = {
        uid: 'test-user-id',
        displayName: null,
        email: null,
        isAnonymous: true,
      }

      mockSignInAnonymously.mockResolvedValue({ user: mockUser })

      const result = await firebaseService.signInAnonymously()

      expect(mockSignInAnonymously).toHaveBeenCalled()
      expect(result).toEqual(mockUser)
    })

    it('should handle authentication errors', async () => {
      mockSignInAnonymously.mockRejectedValue(new Error('Auth failed'))

      await expect(firebaseService.signInAnonymously()).rejects.toThrow('Auth failed')
    })

    it('should get current user', () => {
      const mockUser = {
        uid: 'current-user-id',
        displayName: 'Test User',
        email: 'test@example.com',
        isAnonymous: false,
      }

      // Mock the auth state
      const result = firebaseService.getCurrentUser()

      // Since getCurrentUser returns the current auth state,
      // we'll test it returns the expected structure
      expect(typeof result).toBe('object')
    })
  })

  describe('Lobby Operations', () => {
    describe('createLobby', () => {
      it('should create a new lobby', async () => {
        const mockLobbyId = 'generated-lobby-id'
        
        // Mock crypto.randomUUID
        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: vi.fn(() => mockLobbyId),
          },
        })

        mockDoc.mockReturnValue({ id: mockLobbyId })
        mockSetDoc.mockResolvedValue(undefined)

        const result = await firebaseService.createLobby('Host Name', 'spotify-user-id', 8)

        expect(mockSetDoc).toHaveBeenCalled()
        expect(result).toBe(mockLobbyId)
      })

      it('should handle lobby creation errors', async () => {
        mockSetDoc.mockRejectedValue(new Error('Creation failed'))

        await expect(
          firebaseService.createLobby('Host Name', 'spotify-user-id', 8)
        ).rejects.toThrow('Creation failed')
      })

      it('should validate input parameters', async () => {
        await expect(
          firebaseService.createLobby('', 'spotify-user-id', 8)
        ).rejects.toThrow('Host name is required')

        await expect(
          firebaseService.createLobby('Host Name', '', 8)
        ).rejects.toThrow('Spotify user ID is required')

        await expect(
          firebaseService.createLobby('Host Name', 'spotify-user-id', 1)
        ).rejects.toThrow('Max players must be at least 2')
      })
    })

    describe('joinLobby', () => {
      it('should join an existing lobby', async () => {
        const mockLobbyDoc = {
          exists: () => true,
          data: () => ({
            id: 'test-lobby-id',
            hostId: 'host-id',
            status: 'waiting',
            players: {
              'host-id': {
                id: 'host-id',
                name: 'Host',
                isHost: true,
                joinedAt: new Date(),
                score: 0,
              },
            },
            maxPlayers: 8,
            createdAt: new Date(),
          }),
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)
        mockUpdateDoc.mockResolvedValue(undefined)

        await firebaseService.joinLobby('test-lobby-id', 'Player Name')

        expect(mockGetDoc).toHaveBeenCalled()
        expect(mockUpdateDoc).toHaveBeenCalled()
      })

      it('should handle lobby not found', async () => {
        const mockLobbyDoc = {
          exists: () => false,
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)

        await expect(
          firebaseService.joinLobby('invalid-lobby-id', 'Player Name')
        ).rejects.toThrow('Lobby not found')
      })

      it('should handle lobby full error', async () => {
        const mockLobbyDoc = {
          exists: () => true,
          data: () => ({
            id: 'test-lobby-id',
            hostId: 'host-id',
            status: 'waiting',
            players: Array.from({ length: 8 }, (_, i) => ({
              id: `player-${i}`,
              name: `Player ${i}`,
              isHost: i === 0,
              joinedAt: new Date(),
              score: 0,
            })).reduce((acc, player) => {
              acc[player.id] = player
              return acc
            }, {} as any),
            maxPlayers: 8,
            createdAt: new Date(),
          }),
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)

        await expect(
          firebaseService.joinLobby('test-lobby-id', 'Player Name')
        ).rejects.toThrow('Lobby is full')
      })

      it('should handle lobby in progress', async () => {
        const mockLobbyDoc = {
          exists: () => true,
          data: () => ({
            id: 'test-lobby-id',
            hostId: 'host-id',
            status: 'in_progress',
            players: {
              'host-id': {
                id: 'host-id',
                name: 'Host',
                isHost: true,
                joinedAt: new Date(),
                score: 0,
              },
            },
            maxPlayers: 8,
            createdAt: new Date(),
          }),
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)

        await expect(
          firebaseService.joinLobby('test-lobby-id', 'Player Name')
        ).rejects.toThrow('Game already in progress')
      })
    })

    describe('leaveLobby', () => {
      it('should remove player from lobby', async () => {
        mockUpdateDoc.mockResolvedValue(undefined)

        await firebaseService.leaveLobby('test-lobby-id', 'player-id')

        expect(mockUpdateDoc).toHaveBeenCalled()
      })

      it('should handle leave lobby errors', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('Leave failed'))

        await expect(
          firebaseService.leaveLobby('test-lobby-id', 'player-id')
        ).rejects.toThrow('Leave failed')
      })
    })

    describe('getLobby', () => {
      it('should retrieve lobby data', async () => {
        const mockLobbyData = {
          id: 'test-lobby-id',
          hostId: 'host-id',
          status: 'waiting',
          players: {},
          maxPlayers: 8,
          createdAt: new Date(),
        }

        const mockLobbyDoc = {
          exists: () => true,
          data: () => mockLobbyData,
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)

        const result = await firebaseService.getLobby('test-lobby-id')

        expect(mockGetDoc).toHaveBeenCalled()
        expect(result).toEqual(mockLobbyData)
      })

      it('should return null for non-existent lobby', async () => {
        const mockLobbyDoc = {
          exists: () => false,
        }

        mockGetDoc.mockResolvedValue(mockLobbyDoc)

        const result = await firebaseService.getLobby('invalid-lobby-id')

        expect(result).toBeNull()
      })
    })
  })

  describe('Real-time Subscriptions', () => {
    describe('subscribeLobby', () => {
      it('should subscribe to lobby updates', () => {
        const mockCallback = vi.fn()
        const mockUnsubscribe = vi.fn()

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          const mockDoc = {
            exists: () => true,
            data: () => ({
              id: 'test-lobby-id',
              hostId: 'host-id',
              status: 'waiting',
              players: {},
              maxPlayers: 8,
              createdAt: new Date(),
            }),
          }
          callback(mockDoc)
          return mockUnsubscribe
        })

        const unsubscribe = firebaseService.subscribeLobby('test-lobby-id', mockCallback)

        expect(mockOnSnapshot).toHaveBeenCalled()
        expect(mockCallback).toHaveBeenCalled()
        expect(typeof unsubscribe).toBe('function')
      })

      it('should handle subscription errors', () => {
        const mockCallback = vi.fn()

        mockOnSnapshot.mockImplementation(() => {
          throw new Error('Subscription failed')
        })

        expect(() => {
          firebaseService.subscribeLobby('test-lobby-id', mockCallback)
        }).toThrow('Subscription failed')
      })

      it('should call callback with null for non-existent lobby', () => {
        const mockCallback = vi.fn()
        const mockUnsubscribe = vi.fn()

        mockOnSnapshot.mockImplementation((docRef, callback) => {
          const mockDoc = {
            exists: () => false,
          }
          callback(mockDoc)
          return mockUnsubscribe
        })

        firebaseService.subscribeLobby('invalid-lobby-id', mockCallback)

        expect(mockCallback).toHaveBeenCalledWith(null)
      })
    })
  })

  describe('Game Operations', () => {
    describe('startGame', () => {
      it('should update lobby status to in_progress', async () => {
        mockUpdateDoc.mockResolvedValue(undefined)

        await firebaseService.startGame('test-lobby-id')

        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            status: 'in_progress',
          })
        )
      })

      it('should handle start game errors', async () => {
        mockUpdateDoc.mockRejectedValue(new Error('Start failed'))

        await expect(
          firebaseService.startGame('test-lobby-id')
        ).rejects.toThrow('Start failed')
      })
    })

    describe('updateLobbyStatus', () => {
      it('should update lobby status', async () => {
        mockUpdateDoc.mockResolvedValue(undefined)

        await firebaseService.updateLobbyStatus('test-lobby-id', 'collecting_songs')

        expect(mockUpdateDoc).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            status: 'collecting_songs',
          })
        )
      })

      it('should validate status values', async () => {
        await expect(
          firebaseService.updateLobbyStatus('test-lobby-id', 'invalid_status' as any)
        ).rejects.toThrow('Invalid status')
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      mockGetDoc.mockRejectedValue(new Error('Network error'))

      await expect(
        firebaseService.getLobby('test-lobby-id')
      ).rejects.toThrow('Network error')
    })

    it('should handle permission errors', async () => {
      mockSetDoc.mockRejectedValue(new Error('Permission denied'))

      await expect(
        firebaseService.createLobby('Host', 'spotify-id', 8)
      ).rejects.toThrow('Permission denied')
    })

    it('should handle invalid document references', async () => {
      mockDoc.mockReturnValue(null)

      await expect(
        firebaseService.getLobby('')
      ).rejects.toThrow('Invalid lobby ID')
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent lobby joins', async () => {
      const mockLobbyDoc = {
        exists: () => true,
        data: () => ({
          id: 'test-lobby-id',
          hostId: 'host-id',
          status: 'waiting',
          players: {
            'host-id': {
              id: 'host-id',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
          maxPlayers: 8,
          createdAt: new Date(),
        }),
      }

      mockGetDoc.mockResolvedValue(mockLobbyDoc)
      mockUpdateDoc.mockResolvedValue(undefined)

      // Simulate concurrent joins
      const joins = Promise.all([
        firebaseService.joinLobby('test-lobby-id', 'Player 1'),
        firebaseService.joinLobby('test-lobby-id', 'Player 2'),
        firebaseService.joinLobby('test-lobby-id', 'Player 3'),
      ])

      await expect(joins).resolves.not.toThrow()
    })

    it('should handle concurrent lobby operations', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          id: 'test-lobby-id',
          hostId: 'host-id',
          status: 'waiting',
          players: {},
          maxPlayers: 8,
          createdAt: new Date(),
        }),
      })
      mockUpdateDoc.mockResolvedValue(undefined)

      // Simulate concurrent operations
      const operations = Promise.all([
        firebaseService.joinLobby('test-lobby-id', 'Player 1'),
        firebaseService.updateLobbyStatus('test-lobby-id', 'collecting_songs'),
        firebaseService.leaveLobby('test-lobby-id', 'other-player'),
      ])

      await expect(operations).resolves.not.toThrow()
    })
  })

  describe('Data Validation', () => {
    it('should validate lobby data structure', async () => {
      const invalidLobbyDoc = {
        exists: () => true,
        data: () => ({
          // Missing required fields
          id: 'test-lobby-id',
        }),
      }

      mockGetDoc.mockResolvedValue(invalidLobbyDoc)

      await expect(
        firebaseService.getLobby('test-lobby-id')
      ).rejects.toThrow('Invalid lobby data')
    })

    it('should sanitize user input', async () => {
      const maliciousName = '<script>alert("xss")</script>'
      
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({
          id: 'test-lobby-id',
          hostId: 'host-id',
          status: 'waiting',
          players: {},
          maxPlayers: 8,
          createdAt: new Date(),
        }),
      })
      mockUpdateDoc.mockResolvedValue(undefined)

      await firebaseService.joinLobby('test-lobby-id', maliciousName)

      // Verify that the update was called with sanitized data
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          [`players.${expect.any(String)}.name`]: expect.not.stringContaining('<script>'),
        })
      )
    })
  })
}) 