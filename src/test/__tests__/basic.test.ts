import { describe, it, expect } from 'vitest'

describe('Basic Test Setup', () => {
  it('should work with basic functionality', () => {
    expect(1 + 1).toBe(2)
  })

  it('should have proper environment setup', () => {
    expect(import.meta.env.VITE_FIREBASE_PROJECT_ID).toBeDefined()
  })

  it('should have mocked crypto', () => {
    expect(crypto.randomUUID()).toBe('test-uuid-123')
  })
}) 