import { useSearchParams } from 'react-router-dom'

import { PageHeader } from '@/shared/components/PageHeader/PageHeader'
import { Tabs } from '@/shared/components/Tabs/Tabs'
import { AnalysisPanel } from '../components/AnalysisPanel'
import { ListReports } from '../components/ListReports'

type Tab = 'analysis' | 'lists'

/**
 * Reports, two ways.
 *
 * Analysis is the server's figures over the whole book — sales, stock, and
 * what went out on the vans and came back — grouped however the question
 * needs. Lists are the standing documents composed from the screens' own
 * reads: the customer book, the debtors, the catalogue.
 *
 * Which tab and which report are in the address, so a report somebody is
 * looking at is a link they can send.
 */
export function ReportsPage() {
  const [search, setSearch] = useSearchParams()
  const tab: Tab = search.get('tab') === 'lists' ? 'lists' : 'analysis'

  const choose = (key: string) => {
    const params = new URLSearchParams(search)
    params.set('tab', key)
    setSearch(params, { replace: true })
  }

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Sales, stock and van movements — grouped the way you ask, exported as PDF or Excel"
      />

      <Tabs
        tabs={[
          { key: 'analysis', label: 'Analysis' },
          { key: 'lists', label: 'Lists' },
        ]}
        active={tab}
        onChange={choose}
      />

      <div className="mt-5">{tab === 'analysis' ? <AnalysisPanel /> : <ListReports />}</div>
    </>
  )
}
