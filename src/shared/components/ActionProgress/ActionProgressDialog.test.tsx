import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { ActionProgressDialog } from './ActionProgressDialog'
import { useActionProgress, useActionProgressStore } from '@/shared/hooks/use-action-progress'

/** A promise the test settles by hand, so the in-flight state can be observed. */
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function Harness({ task }: { task: () => Promise<unknown> }) {
  const { run } = useActionProgress()
  return (
    <>
      <button
        onClick={() =>
          run(
            {
              label: 'Creating customer',
              detail: 'Hanna Supermarket',
              success: 'Hanna Supermarket has been saved.',
            },
            task,
          )
        }
      >
        Create customer
      </button>
      <ActionProgressDialog />
    </>
  )
}

beforeEach(() => {
  // The store is module-level, so a previous test's action would still be up.
  useActionProgressStore.setState({ action: null })
})

describe('ActionProgressDialog', () => {
  it('is absent until an action starts', () => {
    render(<Harness task={async () => undefined} />)
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('shows the working state while the task is in flight, then the success line', async () => {
    const user = userEvent.setup()
    const task = deferred<{ id: number }>()
    render(<Harness task={() => task.promise} />)

    await user.click(screen.getByRole('button', { name: 'Create customer' }))

    // In flight: label with its ellipsis, the subject, and aria-busy for AT.
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByText('Creating customer…')).toBeInTheDocument()
    expect(screen.getByText('Hanna Supermarket')).toBeInTheDocument()

    task.resolve({ id: 501 })

    await screen.findByText('Hanna Supermarket has been saved.')
    expect(screen.queryByText('Creating customer…')).not.toBeInTheDocument()
  })

  it('holds on failure with the server message and dismisses on Close', async () => {
    const user = userEvent.setup()
    const task = deferred<never>()
    render(<Harness task={() => task.promise} />)

    await user.click(screen.getByRole('button', { name: 'Create customer' }))
    task.reject({ response: { data: { message: 'The code has already been taken.' } } })

    expect(await screen.findByText('Creating customer failed')).toBeInTheDocument()
    expect(screen.getByText('The code has already been taken.')).toBeInTheDocument()

    // Unlike success, a failure waits to be read rather than self-dismissing.
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})
