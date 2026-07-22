import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// React Testing Library doesn't auto-clean under vitest's globals unless the
// matching afterEach is registered here.
afterEach(() => cleanup())
