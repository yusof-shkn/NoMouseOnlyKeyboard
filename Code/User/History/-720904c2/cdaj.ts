// src/shared/utils/restrictedFilter.utils.ts
// ─────────────────────────────────────────────
// Central helper that applies the is_restricted filter
// to any Supabase query based on the current unlock state.
//
// Usage in any query file:
//   import { applyRestrictedFilter } from '@shared/utils/restrictedFilter.utils'
//
//   let query = supabase.from('sales').select('*')
//   query = applyRestrictedFilter(query, isUnlocked)
// ─────────────────────────────────────────────

/**
 * Applies is_restricted filter to a Supabase query.
 *
 * @param query      - Any Supabase query builder instance
 * @param isUnlocked - Redux state: true = show all data, false = hide restricted records
 * @returns          - The query, with filter applied if locked
 */
export const applyRestrictedFilter = <T>(query: T, isUnlocked: boolean): T => {
  if (!isUnlocked) {
    return (query as any).eq('is_restricted', false) as T
  }
  return query
}

