import { useQuery } from '@tanstack/react-query'
import { getMyScope } from '../lib/api'

/**
 * Returns filter options (companies, functions, departments) for the current user.
 * Options are restricted by the user's data scope (N / N-1 / N-2 or explicit allowed lists).
 * Use these in menu filters so users only see options they are allowed to access.
 */
export function useScopeFilterOptions() {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['myScope'],
    queryFn: getMyScope,
    staleTime: 2 * 60 * 1000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })
  const filterOptions = data?.filter_options ?? {
    companies: [],
    functions: [],
    departments: [],
  }
  /** Weekly Dashboard tab keys (from server role permissions). */
  const visibleTabKeys = data?.visible_tabs ?? []
  /** Dashboard page tab keys: ['function','company','location'] subset. */
  const visibleTabKeysDashboard = data?.visible_tabs_dashboard ?? []
  /** User Wise page tab keys: ['on_time','work_hour','work_hour_lost','leave_analysis','od_analysis'] subset. */
  const visibleTabKeysUserWise = data?.visible_tabs_user_wise ?? []
  /** N, N-1, N-2, N-3, ... from server. */
  const dataScopeLevel = data?.data_scope_level ?? null
  /** True for N-2, N-3, ... (department-only scope: show only Department tab, no function selector). */
  const isDepartmentOnly = Boolean(
    dataScopeLevel &&
    dataScopeLevel !== 'N' &&
    dataScopeLevel !== 'N-1' &&
    /^N-\d+$/.test(String(dataScopeLevel))
  )
  /** Employee Code from Employee List (match by Username / Email (Official)). Used to match attendance rows when file has no email column. */
  const employee_code_from_list = data?.employee_code_from_list ?? null
  /** For non-admin: self + all subordinates (transitive) from organogram. */
  const allowed_employee_emails = Array.isArray(data?.allowed_employee_emails) ? data.allowed_employee_emails : []
  const allowed_employee_codes = Array.isArray(data?.allowed_employee_codes) ? data.allowed_employee_codes : []
  /** Direct reports only (for User Analytics: show only self + direct subordinates). */
  const direct_employee_emails = Array.isArray(data?.direct_employee_emails) ? data.direct_employee_emails : []
  const direct_employee_codes = Array.isArray(data?.direct_employee_codes) ? data.direct_employee_codes : []
  return {
    companies: filterOptions.companies ?? [],
    functions: filterOptions.functions ?? [],
    departments: filterOptions.departments ?? [],
    all: data?.all ?? true,
    visibleTabKeys,
    visibleTabKeysDashboard,
    visibleTabKeysUserWise,
    dataScopeLevel,
    isDepartmentOnly,
    employee_code_from_list,
    allowed_employee_emails,
    allowed_employee_codes,
    direct_employee_emails,
    direct_employee_codes,
    isLoading,
    isError,
    error,
    refetch,
  }
}
