/**
 * The parts of Salesly a company buys separately.
 *
 * A module is the company's switch — has it bought this at all — where a
 * permission is the person's. Both have to be on for a screen to appear. The
 * keys are a contract with the backend's App\Support\Modules and the mobile
 * app, which read the same list off login.
 */
export const MODULES = {
  /** Where the field team is, the trail each van drove, and its replay. */
  LIVE_MAP: 'live_map',
} as const

export type Module = (typeof MODULES)[keyof typeof MODULES]
