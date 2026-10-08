import { useAuthStore } from './auth-store'
import type { Module } from './modules'

/**
 * Whether the company bought a module.
 *
 * No admin bypass, unlike permissions: a module that is off is off for whoever
 * looks — the server refuses it to admins too, and a menu entry that opens onto
 * a refusal is worse than no entry.
 */
export function useModules() {
  const modules = useAuthStore((s) => s.modules)

  const has = (module: Module): boolean => modules.includes(module)

  return { has, modules }
}
