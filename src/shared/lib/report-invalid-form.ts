import { useToastStore } from '@/shared/hooks/use-toast'

/**
 * What a form drawer does instead of returning silently when validation fails:
 * says so, then brings the first flagged field into view and focuses it.
 *
 * Validation that only paints inline errors reads as a dead button when the
 * offending field is above the fold — the customer and product forms both
 * scroll well past their required fields, so pressing Save appears to do
 * nothing at all. Fields get `aria-invalid` from `Input`/`Select` whenever they
 * carry an error, which is exactly the hook needed to find the first one.
 *
 * Scoped to the panel that is actually open: form drawers stay mounted while
 * closed (so their close transition can run) and are marked `aria-hidden`,
 * which would otherwise let a stale error in a closed drawer win.
 *
 * Not a hook, so it can be called from a plain submit handler; the toast store
 * is read straight off zustand rather than through `useToast`.
 */
export function reportInvalidForm(message = 'Some fields still need fixing.'): void {
  useToastStore.getState().show({ type: 'warning', title: 'Check the form', message })

  // After paint: the fields have only just been given their error props.
  requestAnimationFrame(() => {
    const panel =
      document.querySelector('[role="dialog"]:not([aria-hidden="true"])') ?? document.body
    const field = panel.querySelector('[aria-invalid="true"]')
    if (!(field instanceof HTMLElement)) return

    field.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    field.focus?.({ preventScroll: true })
  })
}
