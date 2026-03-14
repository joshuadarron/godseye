/** Paginated API response wrapper. */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  offset: number
  limit: number
}

/** Query parameters for history endpoints. */
export interface HistoryQuery {
  from?: string
  to?: string
}
