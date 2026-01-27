import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTeamsLicense, updateTeamsLicense } from '../lib/api'

const STORAGE_KEY = 'teams_license'

const defaults = {
  totalTeams: 0,
  totalAssigned: 0,
  free: 0,
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
    return { totalTeams, totalAssigned, free }
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
        free: updates.free ?? undefined, // Let backend calculate if not provided
      }
      return updateTeamsLicense(payload)
    },
    onSuccess: (data) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['teams_license'] })
      // Also update localStorage as backup
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          totalTeams: data.total_teams,
          totalAssigned: data.total_assigned,
          free: data.free,
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

  // Use API data if available, otherwise fallback to localStorage
  const license = apiLicense
    ? {
        totalTeams: apiLicense.total_teams || 0,
        totalAssigned: apiLicense.total_assigned || 0,
        free: apiLicense.free || 0,
      }
    : fallbackLicense

  const update = useCallback((updates) => {
    updateMutation.mutate(updates)
  }, [updateMutation])

  return [license, update, updateMutation]
}
