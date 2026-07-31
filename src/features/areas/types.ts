// Contract from GET/POST/PATCH/DELETE /areas — the sales territories customers
// are grouped into. Company-scoped; `code` is unique per company and both code
// and name are required on create. The list always carries `customers_count`,
// which is also what blocks a delete (409) while the area still has customers.

export interface Area {
  id: number
  company_id: number
  code: string
  name: string
  customers_count: number
}

export interface CreateAreaPayload {
  code: string
  name: string
}

export type UpdateAreaPayload = Partial<CreateAreaPayload>
