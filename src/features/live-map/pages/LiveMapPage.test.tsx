import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/core/auth/auth-store'
import { PERMISSIONS } from '@/core/auth/permissions'
import type { FieldMember, FieldTeam, Trail } from '../types'

const NOW = '2026-10-08T12:00:00+00:00'

function member(over: Partial<FieldMember>): FieldMember {
  return {
    id: 1,
    name: 'Ahmad Khalil',
    status: 'active',
    activity: 'moving',
    position: { latitude: 33.89, longitude: 35.48, accuracy: 10, speed: null, heading: null, battery: 72, recorded_at: NOW },
    moved_at: NOW,
    visit: null,
    today: { sales: 1240, invoices: 3, visits: 8, collected: 590 },
    ...over,
  }
}

const TEAM: FieldTeam = {
  members: [
    member({
      id: 1,
      name: 'Ahmad Khalil',
      activity: 'at_customer',
      visit: { id: 4, customer_id: 9, customer_name: 'Al Watan Grocery', checked_in_at: NOW },
    }),
    member({ id: 2, name: 'Karim Nassar', status: 'idle', activity: 'idle', moved_at: '2026-10-08T10:48:00+00:00' }),
    member({ id: 3, name: 'Tarek Aoun', status: 'offline', activity: 'offline', position: null }),
  ],
  summary: { active: 1, idle: 1, offline: 1, total: 3 },
  serverTime: NOW,
}

const TRAIL: Trail = {
  salesman: { id: 1, name: 'Ahmad Khalil' },
  date: '2026-10-08',
  started_at: '2026-10-08T08:00:00+00:00',
  ended_at: '2026-10-08T11:00:00+00:00',
  distance_km: 12.3,
  points: [
    { latitude: 33.8, longitude: 35.4, speed: null, recorded_at: '2026-10-08T08:00:00+00:00' },
    { latitude: 33.9, longitude: 35.5, speed: null, recorded_at: '2026-10-08T11:00:00+00:00' },
  ],
  stops: [],
}

const api = vi.hoisted(() => ({
  fetchTeam: vi.fn(),
  fetchTrail: vi.fn(),
}))

vi.mock('../api/live-map-api', () => api)

// Leaflet needs a real browser to draw tiles; what is under test here is the
// page around the map, so the map is a list of who would be pinned on it.
vi.mock('../components/TeamMap', () => ({
  TeamMap: ({ members }: { members: FieldMember[] }) => (
    <ul aria-label="map pins">
      {members.map((m) => (
        <li key={m.id}>{m.name}</li>
      ))}
    </ul>
  ),
}))

const { LiveMapPage } = await import('./LiveMapPage')

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LiveMapPage />
    </QueryClientProvider>,
  )
}

function signIn(modules: string[]) {
  useAuthStore.setState({
    token: 't',
    role: 'manager',
    permissions: [PERMISSIONS.LIVE_MAP_VIEW],
    modules: modules as never,
    user: { id: '9', name: 'Office', email: 'o@x.test', company: 'Acme Distribution' },
    hasHydrated: true,
  })
}

describe('the live map page', () => {
  beforeEach(() => {
    api.fetchTeam.mockReset().mockResolvedValue(TEAM)
    api.fetchTrail.mockReset().mockResolvedValue(TRAIL)
  })

  it('tells a company that has not bought it, without asking the server', async () => {
    signIn([])
    renderPage()

    expect(await screen.findByText("The live map isn't part of your plan")).toBeInTheDocument()
    expect(api.fetchTeam).not.toHaveBeenCalled()
  })

  it('says the same when the server refuses the module, and something else when it refuses the person', async () => {
    signIn(['live_map'])
    api.fetchTeam.mockRejectedValue({ response: { status: 403, data: { data: { module: 'live_map' } } } })
    const { unmount } = renderPage()
    expect(await screen.findByText("The live map isn't part of your plan")).toBeInTheDocument()
    unmount()

    api.fetchTeam.mockRejectedValue({ response: { status: 403, data: { data: null } } })
    renderPage()
    expect(await screen.findByText("You don't have access to the live map")).toBeInTheDocument()
  })

  it('lists the team with what each is doing and how the day is going', async () => {
    signIn(['live_map'])
    renderPage()

    expect(await screen.findByText('At Al Watan Grocery')).toBeInTheDocument()
    expect(screen.getByText('Idle 1h12m')).toBeInTheDocument()
    expect(screen.getByText('No location yet')).toBeInTheDocument()
    expect(screen.getAllByText('$1,240').length).toBeGreaterThan(0)
    expect(screen.getByText('● 1 active')).toBeInTheDocument()
    expect(screen.getByText('Acme Distribution · All salesmen')).toBeInTheDocument()
  })

  it('narrows the list and the pins to who is idle', async () => {
    signIn(['live_map'])
    renderPage()
    await screen.findByText('At Al Watan Grocery')

    await userEvent.click(screen.getByRole('button', { name: 'Idle' }))

    const pins = within(screen.getByRole('list', { name: 'map pins' }))
    expect(pins.getByText('Karim Nassar')).toBeInTheDocument()
    expect(pins.queryByText('Ahmad Khalil')).not.toBeInTheDocument()
  })

  it('opens a salesman’s day when he is picked, and closes it again', async () => {
    signIn(['live_map'])
    renderPage()
    await screen.findByText('At Al Watan Grocery')

    expect(screen.getByText('Pick a salesman to replay his day.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Ahmad Khalil/ }))

    expect(api.fetchTrail).toHaveBeenCalledWith(1, expect.any(String))
    expect(await screen.findByText(/12\.3 km driven/)).toBeInTheDocument()
    expect(screen.getByText(/^Ahmad Khalil · Today$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play the day back' })).toBeEnabled()

    await userEvent.click(screen.getByRole('button', { name: 'Back to the whole team' }))
    expect(screen.getByText('Acme Distribution · All salesmen')).toBeInTheDocument()
  })

  it('hides offline salesmen from the map when asked, but keeps them in the list', async () => {
    signIn(['live_map'])
    renderPage()
    await screen.findByText('At Al Watan Grocery')

    await userEvent.click(screen.getByRole('button', { name: 'Filters' }))
    await userEvent.click(screen.getByLabelText('Show offline salesmen'))

    const pins = within(screen.getByRole('list', { name: 'map pins' }))
    expect(pins.queryByText('Tarek Aoun')).not.toBeInTheDocument()
    expect(screen.getByText('No location yet')).toBeInTheDocument()
  })
})
