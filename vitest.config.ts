import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import { resolve } from 'path'

// Vitest only defaults NODE_ENV to 'test' when it isn't already set, so a shell
// (or CI image) exporting NODE_ENV=production silently leaks into the run. That
// makes React resolve its production build, which omits `act()`, and every
// render() then dies with "React.act is not a function" — or, further up the
// pipeline, "jsxDEV is not a function". Pin it before anything imports React.
process.env.NODE_ENV = 'test'

// Separate from vite.config.ts so the Tailwind plugin — which the tests don't
// need and which slows every run — stays out of the test pipeline.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // The export suite renders every list page in the console, several times
    // each. Those are genuinely slower than a unit test, and at the 5s default
    // they fail under parallel load while passing on their own — a flake that
    // teaches people to re-run rather than to read the failure.
    testTimeout: 20000,
  },
})
