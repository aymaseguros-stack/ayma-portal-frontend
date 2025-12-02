import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach, beforeAll, afterAll, vi } from 'vitest'
import { server } from './tests/mocks/server'

// Establish API mocking before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers()
  cleanup()
  localStorage.clear()
  vi.clearAllMocks()
})

// Clean up after the tests are finished
afterAll(() => server.close())

// Mock localStorage with actual storage
const storage = {}
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] || null),
  setItem: vi.fn((key, value) => {
    storage[key] = String(value)
  }),
  removeItem: vi.fn((key) => {
    delete storage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(storage).forEach(key => delete storage[key])
  }),
}
global.localStorage = localStorageMock
