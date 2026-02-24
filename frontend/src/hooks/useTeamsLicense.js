import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTeamsLicense, updateTeamsLicense } from '../lib/api'

const STORAGE_KEY = 'teams_license'

const defaults = {
  totalTeams: 0,
  totalAssigned: 0,
  free: 0,
  perLicenseCost: null,
  ciplcLicense: 0,
  cblLicense: 0,
}

// Fallback to localStorage for backward compatibility
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    const totalTeams = Number(data.totalTeams) || 0
    const totalAssigned = Number(data.totalAssigned) || 0
    const f = Number(data.free)
    const free = (!Number.isNaN(f) && f >= 0)
      ? f
      : Math.max(0, totalTeams - totalAssigned)
    const perLicenseCost = data.perLicenseCost != null ? Number(data.perLicenseCost) : null
    const ciplcLicense = Number(data.ciplcLicense) || 0
    const cblLicense = Number(data.cblLicense) || 0
    return {
      totalTeams,
      totalAssigned,
      free,
      perLicenseCost: (perLicenseCost != null && !Number.isNaN(perLicenseCost)) ? perLicenseCost : null,
      ciplcLicense,
      cblLicense,
    }
  } catch {
    return null
  }
}

export function useTeamsLicense() {
  const queryClient = useQueryClient()
  const [fallbackLicense, setFallbackLicense] = useState(() => loadFromStorage() || defaults)

  // Fetch license from backend API
  const { data: apiLicense, isLoading, error } = useQuery({
    queryKey: ['teams_license'],
    queryFn: getTeamsLicense,
    retry: 1,
    staleTime: 5 * 60 * 1000, // 5 minutes
    onError: (err) => {
      // If API fails (403 permission denied, network error, etc.), fall back to localStorage
      if (err.response?.status === 403) {
        console.warn('[TeamsLicense] Permission denied, using localStorage fallback')
      } else {
        console.warn('[TeamsLicense] API fetch failed, using localStorage fallback:', err)
      }
      const stored = loadFromStorage()
      if (stored) {
        setFallbackLicense(stored)
      } else {
        // If no localStorage data, keep defaults (0, 0, 0)
        setFallbackLicense(defaults)
      }
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (updates) => {
      const payload = {
        total_teams: updates.totalTeams ?? 0,
        total_assigned: updates.totalAssigned ?? 0,
        free: updates.free ?? undefined,
        per_license_cost: updates.perLicenseCost !== undefined ? (updates.perLicenseCost === null || updates.perLicenseCost === '' ? null : Number(updates.perLicenseCost)) : undefined,
        ciplc_license: updates.ciplcLicense !== undefined ? (Number(updates.ciplcLicense) || 0) : undefined,
        cbl_license: updates.cblLicense !== undefined ? (Number(updates.cblLicense) || 0) : undefined,
      }
      return updateTeamsLicense(payload)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams_license'] })
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          totalTeams: data.total_teams,
          totalAssigned: data.total_assigned,
          free: data.free,
          perLicenseCost: data.per_license_cost != null ? data.per_license_cost : null,
          ciplcLicense: data.ciplc_license != null ? data.ciplc_license : 0,
          cblLicense: data.cbl_license != null ? data.cbl_license : 0,
        }))
      } catch (e) {
        console.warn('Failed to save to localStorage:', e)
      }
    },
    onError: (err) => {
      console.error('[TeamsLicense] Update failed:', err)
      throw err
    },
  })

  const license = apiLicense
    ? {
        totalTeams: apiLicense.total_teams || 0,
        totalAssigned: apiLicense.total_assigned || 0,
        free: apiLicense.free || 0,
        perLicenseCost: apiLicense.per_license_cost != null ? apiLicense.per_license_cost : null,
        ciplcLicense: apiLicense.ciplc_license != null ? apiLicense.ciplc_license : 0,
        cblLicense: apiLicense.cbl_license != null ? apiLicense.cbl_license : 0,
      }
    : fallbackLicense

  const update = useCallback((updates) => {
    updateMutation.mutate(updates)
  }, [updateMutation])

  return [license, update, updateMutation]
}
