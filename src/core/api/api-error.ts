/**
 * Turns an axios/Laravel failure into one line a user can act on.
 *
 * Laravel returns validation failures under `errors` (and, on some of this
 * API's endpoints, under `data`), so both shapes are unwrapped to their first
 * message; anything else falls back to the response's `message`. A request
 * that never got a response means the backend isn't reachable, which is worth
 * saying outright rather than reporting as a generic failure.
 *
 * Lives here rather than in a feature folder because every mutation in the app
 * reports errors through it — `features/users/hooks/use-users` re-exports it
 * for the callers that have always imported it from there.
 */
export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  const e = err as {
    response?: {
      data?: { errors?: Record<string, string[]>; data?: Record<string, string[]>; message?: string }
    }
  }
  const resData = e?.response?.data
  if (!e?.response) return 'Cannot reach server. Make sure the backend is running.'
  if (resData?.errors) return (Object.values(resData.errors).flat()[0] as string) ?? fallback
  if (resData?.data) return (Object.values(resData.data).flat()[0] as string) ?? fallback
  return resData?.message ?? fallback
}
