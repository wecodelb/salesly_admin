import type { AssignableRole, CompanyUser } from './types'

/**
 * What the signed-in user may not do to one member of the team, and why.
 *
 * Each field is the reason shown to the user, or `null` when nothing is locked. A reason
 * rather than a boolean, because a button that is simply missing reads as a bug
 * — "why can't I remove him?" deserves an answer on the button itself.
 *
 * These mirror nothing on the server: the backend's user update and delete take
 * whatever they are sent. So this is the only thing standing between an admin
 * and demoting the owner or suspending themselves out of their own company, and
 * it errs on the side of refusing.
 */
export interface MemberLocks {
  /** Role and permissions. The profile (name, email, phone) stays editable. */
  access: string | null
  /** Deactivating and removing. Reactivating is never locked — it only restores. */
  membership: string | null
}

export interface Editor {
  /** The signed-in user's id, as the auth store keeps it (a string). */
  id: string | undefined
  isAdmin: boolean
}

const UNLOCKED: MemberLocks = { access: null, membership: null }

export function memberLocks(member: CompanyUser, editor: Editor): MemberLocks {
  // The owner comes with the company. Their membership is what the company
  // was created around, and the users list reports it as its own role, which
  // no role on this form can express — saving one would demote them.
  if (member.role === 'owner') {
    return {
      access: "The company owner's role and permissions come with the company and can't be changed here.",
      membership: "The company owner can't be deactivated or removed.",
    }
  }

  // Suspending yourself kills your own session on the spot, and taking your
  // own admin away can leave a company nobody is able to manage.
  if (editor.id != null && String(member.id) === editor.id) {
    return {
      access: "You can't change your own role or permissions. Ask another admin.",
      membership: "You can't deactivate or remove your own account.",
    }
  }

  // A manager holding users.edit may run the team, but not the people above
  // them: otherwise the key to manage salesmen is also the key to demote the admin.
  if (member.role === 'admin' && !editor.isAdmin) {
    return {
      access: "Only an admin can change another admin's role or permissions.",
      membership: 'Only an admin can deactivate or remove an admin.',
    }
  }

  return UNLOCKED
}

export function isAssignableRole(role: string | null | undefined): role is AssignableRole {
  return role === 'admin' || role === 'manager' || role === 'salesman'
}

/**
 * The roles this editor may hand out. Admin is only offered by an admin: a
 * manager who could create an admin could create themselves a second account
 * with everything.
 */
export function grantableRoles<T extends { value: AssignableRole }>(
  options: T[],
  editor: Pick<Editor, 'isAdmin'>,
): T[] {
  return editor.isAdmin ? options : options.filter((o) => o.value !== 'admin')
}
