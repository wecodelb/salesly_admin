import { qty, scopeLine, text } from '@/features/reports/report-format'
import type { ReportDocument, ReportGroup } from '@/features/reports/report-types'
import type { CompanyUser } from './types'

/**
 * The team, as a printed page.
 *
 * Grouped by role, which is the only way anybody asks for it — "who are my
 * salesmen" rather than "list everyone alphabetically". Permissions are printed
 * as a count rather than a list: forty permission slugs per row would fill the
 * page and nobody reads a PDF to audit them.
 */
export function usersExportDoc(
  rows: CompanyUser[],
  total: number,
  filters: Array<string | false | null | undefined>,
): ReportDocument<CompanyUser> {
  return {
    title: 'Team',
    subtitle: scopeLine(rows.length, total, 'users', filters),
    columns: [
      { header: 'Name', value: (u) => text(u.name), width: '26%' },
      { header: 'Email', value: (u) => text(u.email), width: '30%' },
      { header: 'Phone', value: (u) => text(u.phone), width: '16%' },
      { header: 'Role', value: (u) => titleCase(u.role), width: '14%' },
      {
        header: 'Permissions',
        kind: 'number',
        value: (u) => qty(u.permissions?.length ?? 0),
        width: '7%',
      },
      { header: 'Status', value: (u) => titleCase(u.status), width: '7%' },
    ],
    groups: byRole(rows),
    summary: [
      { label: 'Users', value: qty(rows.length) },
      { label: 'Salesmen', value: qty(rows.filter((u) => u.role === 'salesman').length) },
      { label: 'Active', value: qty(rows.filter((u) => u.status === 'active').length) },
    ],
    emptyMessage: 'No users match these filters.',
  }
}

function byRole(rows: CompanyUser[]): ReportGroup<CompanyUser>[] {
  const buckets = new Map<string, CompanyUser[]>()
  for (const row of rows) {
    const key = titleCase(row.role)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([title, group]) => ({
      key: title,
      title,
      caption: `${qty(group.length)} ${group.length === 1 ? 'person' : 'people'}`,
      rows: group,
    }))
}

/** Roles and statuses arrive lowercase; a printed heading should not shout. */
function titleCase(value: string | null | undefined): string {
  if (!value) return '—'
  return value.charAt(0).toUpperCase() + value.slice(1)
}
