import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { PhoneInput } from './PhoneInput'

/** Controlled the way the form drawers use it, so typing behaves as it does there. */
function Harness({ initial = '', onValue }: { initial?: string; onValue?: (v: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <PhoneInput
        label="Phone 1"
        value={value}
        onChange={(v) => {
          setValue(v)
          onValue?.(v)
        }}
      />
      <span data-testid="stored">{value}</span>
    </>
  )
}

const stored = () => screen.getByTestId('stored').textContent

describe('PhoneInput', () => {
  it('starts on Lebanon so the common case needs no picking', () => {
    render(<Harness />)
    expect(screen.getByRole('button', { name: /country code: Lebanon \+961/i })).toBeInTheDocument()
  })

  it('stores the typed number behind the selected code, without the trunk zero', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.type(screen.getByLabelText('Phone 1'), '03456789')

    expect(stored()).toBe('+961 3456789')
  })

  it('switches country from the list and keeps the number', async () => {
    const user = userEvent.setup()
    render(<Harness initial="+961 3 456 789" />)

    await user.click(screen.getByRole('button', { name: /country code/i }))
    await user.click(await screen.findByRole('option', { name: /United Arab Emirates/i }))

    expect(stored()).toBe('+971 3 456 789')
    expect(screen.getByRole('button', { name: /country code: United Arab Emirates/i })).toBeInTheDocument()
  })

  it('finds a country by dial code as well as by name', async () => {
    const user = userEvent.setup()
    render(<Harness />)

    await user.click(screen.getByRole('button', { name: /country code/i }))
    await user.type(await screen.findByLabelText('Search countries'), '20')

    const options = screen.getAllByRole('option')
    expect(options[0]).toHaveTextContent('Egypt')
  })

  it('shows an existing international number split into its two halves', () => {
    render(<Harness initial="+962 7 900 000" />)

    expect(screen.getByRole('button', { name: /Jordan \+962/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Phone 1')).toHaveValue('7 900 000')
  })

  it('clears to empty rather than leaving a bare dial code behind', async () => {
    const user = userEvent.setup()
    const onValue = vi.fn()
    render(<Harness initial="+961 3 456 789" onValue={onValue} />)

    await user.clear(screen.getByLabelText('Phone 1'))

    expect(stored()).toBe('')
  })
})
