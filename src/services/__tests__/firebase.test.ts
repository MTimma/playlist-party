import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  createLobby,
  joinLobby,
  getLobby,
  subscribeLobby,
  updateLobbyStatus,
  leaveLobby,
  signInAnonymouslyIfNeeded,
  getCurrentUser,
} from '../firebase'
import type { Lobby, Player } from '../../types/types'

// Mock Firebase modules
vi.mock('firebase/firestore', () => ({
  initializeApp: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  doc: vi.fn((db, collection, id) => ({ id, collection })),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  updateDoc: vi.fn(),
  onSnapshot: vi.fn(),
  collection: vi.fn((db, name) => ({ name })),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({
    currentUser: null,
  })),
  signInAnonymously: vi.fn(),
  onAuthStateChanged: vi.fn(),
}))

// Import mocked functions
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  collection,
  serverTimestamp,
} from 'firebase/firestore'
import { signInAnonymously, onAuthStateChanged, getAuth } from 'firebase/auth'

const createMockUser = (uid = 'test-user-uid') => ({
  uid,
  email: null,
  displayName: null,
  isAnonymous: true,
})

const createMockLobby = (overrides: Partial<Lobby> = {}): Lobby => ({
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
  },
  ...overrides,
})

describe('Firebase Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('Authentication', () => {
    describe('signInAnonymouslyIfNeeded', () => {
      it('should return existing user if already signed in', async () => {
        const mockUser = createMockUser()
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn() // unsubscribe function
        })

        const result = await signInAnonymouslyIfNeeded()

        expect(result).toEqual(mockUser)
        expect(signInAnonymously).not.toHaveBeenCalled()
      })

      it('should sign in anonymously if no user exists', async () => {
        const mockUser = createMockUser()
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(null) // No user initially
          return vi.fn()
        })
        ;(signInAnonymously as any).mockResolvedValueOnce({ user: mockUser })

        const result = await signInAnonymouslyIfNeeded()

        expect(signInAnonymously).toHaveBeenCalled()
        expect(result).toEqual(mockUser)
      })

      it('should handle sign in error', async () => {
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(null)
          return vi.fn()
        })
        ;(signInAnonymously as any).mockRejectedValueOnce(new Error('Sign in failed'))

        await expect(signInAnonymouslyIfNeeded()).rejects.toThrow('Sign in failed')
      })
    })
  })

  describe('Lobby Management', () => {
    describe('createLobby', () => {
      it('should create lobby successfully', async () => {
        const mockUser = createMockUser('host-uid')
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(collection as any).mockReturnValue({ name: 'lobbies' })
        ;(doc as any).mockReturnValue({ id: 'generated-lobby-id', collection: 'lobbies' })
        ;(setDoc as any).mockResolvedValueOnce(undefined)

        const result = await createLobby('Host Name', 'spotify-user-id', 8)

        expect(result).toBe('generated-lobby-id')
        expect(setDoc).toHaveBeenCalledWith(
          { id: 'generated-lobby-id', collection: 'lobbies' },
          expect.objectContaining({
            id: 'generated-lobby-id',
            hostFirebaseUid: 'host-uid',
            hostSpotifyUserId: 'spotify-user-id',
            status: 'waiting',
            maxPlayers: 8,
            players: expect.objectContaining({
              'host-uid': expect.objectContaining({
                id: 'host-uid',
                name: 'Host Name',
                isHost: true,
                score: 0,
              }),
            }),
            createdAt: { _serverTimestamp: true },
          })
        )
      })

      it('should use default max players when not provided', async () => {
        const mockUser = createMockUser('host-uid')
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(collection as any).mockReturnValue({ name: 'lobbies' })
        ;(doc as any).mockReturnValue({ id: 'generated-lobby-id', collection: 'lobbies' })
        ;(setDoc as any).mockResolvedValueOnce(undefined)

        await createLobby('Host Name', 'spotify-user-id')

        expect(setDoc).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({
            maxPlayers: 8, // default value
          })
        )
      })

      it('should handle creation error', async () => {
        const mockUser = createMockUser('host-uid')
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(collection as any).mockReturnValue({ name: 'lobbies' })
        ;(doc as any).mockReturnValue({ id: 'generated-lobby-id', collection: 'lobbies' })
        ;(setDoc as any).mockRejectedValueOnce(new Error('Firestore error'))

        await expect(createLobby('Host Name', 'spotify-user-id')).rejects.toThrow('Firestore error')
      })
    })

    describe('joinLobby', () => {
      it('should join lobby successfully', async () => {
        const mockUser = createMockUser('player-uid')
        const mockLobby = createMockLobby({
          status: 'waiting',
          maxPlayers: 8,
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
          },
        })

        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => mockLobby,
        })
        ;(updateDoc as any).mockResolvedValueOnce(undefined)

        const result = await joinLobby('test-lobby-id', 'Player Name')

        expect(result).toBe(true)
        expect(updateDoc).toHaveBeenCalledWith(
          { id: 'test-lobby-id', collection: 'lobbies' },
          {
            'players.player-uid': expect.objectContaining({
              id: 'player-uid',
              name: 'Player Name',
              isHost: false,
              score: 0,
            }),
          }
        )
      })

      it('should throw error when lobby not found', async () => {
        const mockUser = createMockUser('player-uid')
        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => false,
        })

        await expect(joinLobby('test-lobby-id', 'Player Name')).rejects.toThrow('Lobby not found')
      })

      it('should throw error when lobby is not accepting players', async () => {
        const mockUser = createMockUser('player-uid')
        const mockLobby = createMockLobby({ status: 'in_progress' })

        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => mockLobby,
        })

        await expect(joinLobby('test-lobby-id', 'Player Name')).rejects.toThrow('Lobby is not accepting new players')
      })

      it('should throw error when lobby is full', async () => {
        const mockUser = createMockUser('player-uid')
        const players: { [key: string]: Player } = {}
        for (let i = 0; i < 8; i++) {
          players[`player-${i}`] = {
            id: `player-${i}`,
            name: `Player ${i}`,
            isHost: i === 0,
            joinedAt: new Date(),
            score: 0,
          }
        }
        const mockLobby = createMockLobby({
          status: 'waiting',
          maxPlayers: 8,
          players,
        })

        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => mockLobby,
        })

        await expect(joinLobby('test-lobby-id', 'Player Name')).rejects.toThrow('Lobby is full')
      })

      it('should throw error when player already in lobby', async () => {
        const mockUser = createMockUser('existing-player-uid')
        const mockLobby = createMockLobby({
          status: 'waiting',
          players: {
            'host-uid': {
              id: 'host-uid',
              name: 'Host',
              isHost: true,
              joinedAt: new Date(),
              score: 0,
            },
            'existing-player-uid': {
              id: 'existing-player-uid',
              name: 'Existing Player',
              isHost: false,
              joinedAt: new Date(),
              score: 0,
            },
          },
        })

        ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
          callback(mockUser)
          return vi.fn()
        })
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => mockLobby,
        })

        await expect(joinLobby('test-lobby-id', 'Player Name')).rejects.toThrow('Player already in lobby')
      })
    })

    describe('getLobby', () => {
      it('should get lobby successfully', async () => {
        const mockLobby = createMockLobby()
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            ...mockLobby,
            createdAt: { toDate: () => mockLobby.createdAt },
          }),
        })

        const result = await getLobby('test-lobby-id')

        expect(result).toEqual(mockLobby)
      })

      it('should return null when lobby not found', async () => {
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => false,
        })

        const result = await getLobby('test-lobby-id')

        expect(result).toBeNull()
      })

      it('should handle missing createdAt timestamp', async () => {
        const mockLobby = { ...createMockLobby(), createdAt: undefined }
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(getDoc as any).mockResolvedValueOnce({
          exists: () => true,
          data: () => mockLobby,
        })

        const result = await getLobby('test-lobby-id')

        expect(result?.createdAt).toBeInstanceOf(Date)
      })
    })

    describe('subscribeLobby', () => {
      it('should subscribe to lobby updates', () => {
        const mockCallback = vi.fn()
        const mockUnsubscribe = vi.fn()
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(onSnapshot as any).mockImplementation((docRef, callback) => {
          // Simulate initial data
          callback({
            exists: () => true,
            data: () => ({
              ...createMockLobby(),
              createdAt: { toDate: () => new Date('2023-01-01T10:00:00Z') },
            }),
          })
          return mockUnsubscribe
        })

        const unsubscribe = subscribeLobby('test-lobby-id', mockCallback)

        expect(onSnapshot).toHaveBeenCalledWith(
          { id: 'test-lobby-id', collection: 'lobbies' },
          expect.any(Function)
        )
        expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
          id: 'test-lobby-id',
          hostFirebaseUid: 'host-uid',
        }))
        expect(unsubscribe).toBe(mockUnsubscribe)
      })

      it('should call callback with null when lobby does not exist', () => {
        const mockCallback = vi.fn()
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(onSnapshot as any).mockImplementation((docRef, callback) => {
          callback({
            exists: () => false,
          })
          return vi.fn()
        })

        subscribeLobby('test-lobby-id', mockCallback)

        expect(mockCallback).toHaveBeenCalledWith(null)
      })
    })

    describe('updateLobbyStatus', () => {
      it('should update lobby status successfully', async () => {
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(updateDoc as any).mockResolvedValueOnce(undefined)

        await updateLobbyStatus('test-lobby-id', 'collecting_songs')

        expect(updateDoc).toHaveBeenCalledWith(
          { id: 'test-lobby-id', collection: 'lobbies' },
          { status: 'collecting_songs' }
        )
      })

      it('should handle update error', async () => {
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(updateDoc as any).mockRejectedValueOnce(new Error('Update failed'))

        await expect(updateLobbyStatus('test-lobby-id', 'collecting_songs')).rejects.toThrow('Update failed')
      })
    })

    describe('leaveLobby', () => {
      it('should leave lobby successfully', async () => {
        const mockUser = createMockUser('player-uid')
        // Mock auth.currentUser directly
        const mockAuth = { currentUser: mockUser }
        vi.mocked(getAuth).mockReturnValue(mockAuth as any)
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(updateDoc as any).mockResolvedValueOnce(undefined)

        await leaveLobby('test-lobby-id')

        expect(updateDoc).toHaveBeenCalledWith(
          { id: 'test-lobby-id', collection: 'lobbies' },
          { 'players.player-uid': null }
        )
      })

      it('should handle case when no user is signed in', async () => {
        const mockAuth = { currentUser: null }
        vi.mocked(getAuth).mockReturnValue(mockAuth as any)

        // Should not throw error and should not call updateDoc
        await leaveLobby('test-lobby-id')

        expect(updateDoc).not.toHaveBeenCalled()
      })

      it('should handle leave error', async () => {
        const mockUser = createMockUser('player-uid')
        const mockAuth = { currentUser: mockUser }
        vi.mocked(getAuth).mockReturnValue(mockAuth as any)
        ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
        ;(updateDoc as any).mockRejectedValueOnce(new Error('Leave failed'))

        await expect(leaveLobby('test-lobby-id')).rejects.toThrow('Leave failed')
      })
    })
  })

  describe('Edge Cases and Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const mockUser = createMockUser('player-uid')
      ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })
      ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
      ;(getDoc as any).mockRejectedValueOnce(new Error('Network error'))

      await expect(joinLobby('test-lobby-id', 'Player Name')).rejects.toThrow('Network error')
    })

    it('should handle invalid lobby data', async () => {
      ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
      ;(getDoc as any).mockResolvedValueOnce({
        exists: () => true,
        data: () => null, // Invalid data
      })

      const result = await getLobby('test-lobby-id')

      // Should handle gracefully and return valid lobby structure
      expect(result).toEqual(expect.objectContaining({
        createdAt: expect.any(Date),
      }))
    })

    it('should handle concurrent lobby joins', async () => {
      const mockUser1 = createMockUser('player-1')
      const mockUser2 = createMockUser('player-2')
      const mockLobby = createMockLobby({
        status: 'waiting',
        maxPlayers: 2,
        players: {
          'host-uid': {
            id: 'host-uid',
            name: 'Host',
            isHost: true,
            joinedAt: new Date(),
            score: 0,
          },
        },
      })

      // Simulate concurrent joins by both users seeing the same lobby state
      ;(doc as any).mockReturnValue({ id: 'test-lobby-id', collection: 'lobbies' })
      ;(getDoc as any).mockResolvedValue({
        exists: () => true,
        data: () => mockLobby,
      })
      ;(updateDoc as any).mockResolvedValue(undefined)

      // First user joins
      ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
        callback(mockUser1)
        return vi.fn()
      })
      const result1 = await joinLobby('test-lobby-id', 'Player 1')

      // Second user joins
      ;(onAuthStateChanged as any).mockImplementation((auth, callback) => {
        callback(mockUser2)
        return vi.fn()
      })
      const result2 = await joinLobby('test-lobby-id', 'Player 2')

      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(updateDoc).toHaveBeenCalledTimes(2)
    })
  })
}) 