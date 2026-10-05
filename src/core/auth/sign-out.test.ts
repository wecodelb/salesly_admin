import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { apiClient } from '@/core/api/client'
import { useAuthStore } from './auth-store'
import { signOut } from './sign-out'

/**
 * Sign-out against the real axios client, with only the transport swapped out.
 * Mocking apiClient itself would hide the bug this guards: axios's request
 * interceptors run asynchronously, and the old sign-out cleared the token
 * before the interceptor read it, so /logout went out anonymous.
 */

const originalAdapter = apiClient.defaults.adapter
const originalLocation = window.location
let sent: InternalAxiosRequestConfig[]

const respond = (status: number): AxiosAdapter => async (config) => {
  sent.push(config)
  if (status >= 400) {
    throw Object.assign(new Error(`HTTP ${status}`), {
      config,
      response: { status, data: {}, headers: {}, config, statusText: '' },
    })
  }
  return { data: {}, status, statusText: 'OK', headers: {}, config }
}

beforeEach(() => {
  sent = []
  useAuthStore.setState({
    token: 'tok-123',
    user: { id: '1', name: 'Admin', email: 'a@demo.test' },
    role: 'admin',
    permissions: [],
  })
  // jsdom can't navigate; a plain object records where we were sent instead.
  Object.defineProperty(window, 'location', { configurable: true, value: { href: '/dashboard' } })
})

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter
  Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
})

describe('signOut', () => {
  it('sends the revoke with the bearer token still attached', async () => {
    apiClient.defaults.adapter = respond(200)
    await signOut()

    expect(sent).toHaveLength(1)
    expect(sent[0].url).toBe('/logout')
    expect(String(sent[0].headers.Authorization)).toBe('Bearer tok-123')
  })

  it('clears the session and goes to the login page afterwards', async () => {
    apiClient.defaults.adapter = respond(200)
    await signOut()

    expect(useAuthStore.getState().token).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('still signs out locally when the server refuses or is unreachable', async () => {
    apiClient.defaults.adapter = respond(500)
    await signOut()

    expect(useAuthStore.getState().token).toBeNull()
    expect(window.location.href).toBe('/login')
  })

  it('bounds the wait, so a hung server cannot keep the user signed in', async () => {
    apiClient.defaults.adapter = respond(200)
    await signOut()
    expect(sent[0].timeout).toBeGreaterThan(0)
  })

  it('does not call the server when there is no session to revoke', async () => {
    useAuthStore.setState({ token: null })
    apiClient.defaults.adapter = vi.fn(respond(200))
    await signOut()

    expect(apiClient.defaults.adapter).not.toHaveBeenCalled()
    expect(window.location.href).toBe('/login')
  })
})
