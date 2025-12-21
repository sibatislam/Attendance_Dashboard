import { useState, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTeamsFiles, listEmployeeFiles, getTeamsUserActivity, getTeamsFunctionActivity, getTeamsCompanyActivity, getTeamsCXOActivity, listCXOUsers, listEmployeesWithCXOStatus, markEmployeeAsCXO, unmarkEmployeeAsCXO } from '../../lib/api'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, LabelList, Cell } from 'recharts'
import ActivityBar from '../../components/ActivityBar'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

export default function TeamsDashboardPage() {
  const [activeTab, setActiveTab] = useState('user') // user, function, company, cxo
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [selectedEmployeeFileId, setSelectedEmployeeFileId] = useState(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [compareMode, setCompareMode] = useState(false)
  const [compareFileId, setCompareFileId] = useState(null)
  const [groupCompareMode, setGroupCompareMode] = useState(false) // For function/company comparison
  const [groupCompareFileId, setGroupCompareFileId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const [showCXOManagement, setShowCXOManagement] = useState(false)
  const [selectedEmployeeFileForCXO, setSelectedEmployeeFileForCXO] = useState(null)
  const [cxoSearchQuery, setCxoSearchQuery] = useState('')
  const chartRef = useRef(null)
  const queryClient = useQueryClient()

  const { data: files = [], isLoading: isLoadingFiles } = useQuery({
    queryKey: ['teams_files'],
    queryFn: listTeamsFiles,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onSuccess: (data) => {
      // Auto-select the latest file (first in the list)
      if (data.length > 0 && selectedFileId === null) {
        setSelectedFileId(data[0].id)
      }
    }
  })

  const { data: employeeFiles = [], isLoading: isLoadingEmployeeFiles } = useQuery({
    queryKey: ['employee_files'],
    queryFn: listEmployeeFiles,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    onSuccess: (data) => {
      // Auto-select the latest employee file
      if (data.length > 0 && selectedEmployeeFileId === null) {
        setSelectedEmployeeFileId(data[0].id)
      }
    }
  })

  const { data: userData = [], isLoading: isLoadingData } = useQuery({
    queryKey: ['teams_user_activity', selectedFileId],
    queryFn: () => getTeamsUserActivity(selectedFileId),
    enabled: files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: compareData = [], isLoading: isLoadingCompare } = useQuery({
    queryKey: ['teams_user_activity_compare', compareFileId],
    queryFn: () => getTeamsUserActivity(compareFileId),
    enabled: compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: functionData = [], isLoading: isLoadingFunction } = useQuery({
    queryKey: ['teams_function_activity', selectedFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsFunctionActivity(selectedFileId, selectedEmployeeFileId),
    enabled: activeTab === 'function' && files.length > 0 && employeeFiles.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: companyData = [], isLoading: isLoadingCompany } = useQuery({
    queryKey: ['teams_company_activity', selectedFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsCompanyActivity(selectedFileId, selectedEmployeeFileId),
    enabled: activeTab === 'company' && files.length > 0 && employeeFiles.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  // Comparison data for function/company
  const { data: functionCompareData = [], isLoading: isLoadingFunctionCompare } = useQuery({
    queryKey: ['teams_function_activity_compare', groupCompareFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsFunctionActivity(groupCompareFileId, selectedEmployeeFileId),
    enabled: groupCompareMode && groupCompareFileId !== null && activeTab === 'function',
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: companyCompareData = [], isLoading: isLoadingCompanyCompare } = useQuery({
    queryKey: ['teams_company_activity_compare', groupCompareFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsCompanyActivity(groupCompareFileId, selectedEmployeeFileId),
    enabled: groupCompareMode && groupCompareFileId !== null && activeTab === 'company',
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  // CXO data queries
  const { data: cxoData = [], isLoading: isLoadingCXO } = useQuery({
    queryKey: ['teams_cxo_activity', selectedFileId],
    queryFn: () => getTeamsCXOActivity(selectedFileId),
    enabled: activeTab === 'cxo' && files.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: cxoCompareData = [], isLoading: isLoadingCXOCompare } = useQuery({
    queryKey: ['teams_cxo_activity_compare', compareFileId],
    queryFn: () => getTeamsCXOActivity(compareFileId),
    enabled: activeTab === 'cxo' && compareMode && compareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: cxoUsers = [], isLoading: isLoadingCXOUsers } = useQuery({
    queryKey: ['cxo_users'],
    queryFn: listCXOUsers,
    enabled: activeTab === 'cxo',
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const { data: employeesWithCXO = [], isLoading: isLoadingEmployees } = useQuery({
    queryKey: ['employees_with_cxo', selectedEmployeeFileForCXO],
    queryFn: () => listEmployeesWithCXOStatus(selectedEmployeeFileForCXO),
    enabled: activeTab === 'cxo' && showCXOManagement && employeeFiles.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  // CXO mutations with optimistic updates
  const markCXOMutation = useMutation({
    mutationFn: markEmployeeAsCXO,
    onMutate: async (email) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['employees_with_cxo'])
      
      // Snapshot previous value
      const previousEmployees = queryClient.getQueryData(['employees_with_cxo', selectedEmployeeFileForCXO])
      
      // Optimistically update to the new value
      queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], (old) => {
        if (!old) return old
        return old.map(emp => 
          emp.email.toLowerCase() === email.toLowerCase() 
            ? { ...emp, is_cxo: true }
            : emp
        )
      })
      
      return { previousEmployees }
    },
    onSuccess: () => {
      // Silently refetch to ensure consistency (don't show alerts on success)
      queryClient.invalidateQueries(['cxo_users'])
      queryClient.invalidateQueries(['employees_with_cxo'])
      queryClient.invalidateQueries(['teams_cxo_activity'])
    },
    onError: (error, email, context) => {
      console.error('Mark CXO error:', error)
      
      // For network errors, don't rollback immediately - the operation might have succeeded
      // Just invalidate to check server state
      if (!error.response) {
        // Network error - operation might have succeeded on server
        // Silently check server state by invalidating queries
        queryClient.invalidateQueries(['employees_with_cxo'])
        queryClient.invalidateQueries(['cxo_users'])
        // Don't show alert - let the optimistic update stay, server will correct if needed
        return
      }
      
      // Rollback only for actual server errors (not network timeouts)
      if (context?.previousEmployees && error.response?.status >= 400) {
        queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], context.previousEmployees)
      }
      
      // Only show alerts for actual server errors
      if (error.response?.status === 403) {
        alert('Access denied: Admin privileges required to mark employees as CXO')
      } else if (error.response?.status === 401) {
        alert('Authentication required. Please log in again.')
      } else if (error.response?.status >= 400) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to mark employee as CXO'
        alert(`Error: ${errorMessage}`)
      }
    }
  })

  const unmarkCXOMutation = useMutation({
    mutationFn: unmarkEmployeeAsCXO,
    onMutate: async (email) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries(['employees_with_cxo'])
      
      // Snapshot previous value
      const previousEmployees = queryClient.getQueryData(['employees_with_cxo', selectedEmployeeFileForCXO])
      
      // Optimistically update to the new value
      queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], (old) => {
        if (!old) return old
        return old.map(emp => 
          emp.email.toLowerCase() === email.toLowerCase() 
            ? { ...emp, is_cxo: false }
            : emp
        )
      })
      
      return { previousEmployees }
    },
    onSuccess: () => {
      // Silently refetch to ensure consistency (don't show alerts on success)
      queryClient.invalidateQueries(['cxo_users'])
      queryClient.invalidateQueries(['employees_with_cxo'])
      queryClient.invalidateQueries(['teams_cxo_activity'])
    },
    onError: (error, email, context) => {
      console.error('Unmark CXO error:', error)
      
      // For network errors, don't rollback immediately - the operation might have succeeded
      // Just invalidate to check server state
      if (!error.response) {
        // Network error - operation might have succeeded on server
        // Silently check server state by invalidating queries
        queryClient.invalidateQueries(['employees_with_cxo'])
        queryClient.invalidateQueries(['cxo_users'])
        // Don't show alert - let the optimistic update stay, server will correct if needed
        return
      }
      
      // Rollback only for actual server errors (not network timeouts)
      if (context?.previousEmployees && error.response?.status >= 400) {
        queryClient.setQueryData(['employees_with_cxo', selectedEmployeeFileForCXO], context.previousEmployees)
      }
      
      // Only show alerts for actual server errors
      if (error.response?.status === 403) {
        alert('Access denied: Admin privileges required to unmark employees as CXO')
      } else if (error.response?.status === 401) {
        alert('Authentication required. Please log in again.')
      } else if (error.response?.status >= 400) {
        const errorMessage = error.response?.data?.detail || error.message || 'Failed to unmark employee as CXO'
        alert(`Error: ${errorMessage}`)
      }
    }
  })

  const isLoading = isLoadingFiles || isLoadingEmployeeFiles || isLoadingData || (compareMode && isLoadingCompare) || isLoadingFunction || isLoadingCompany || isLoadingFunctionCompare || isLoadingCompanyCompare || isLoadingCXO || isLoadingCXOCompare || isLoadingCXOUsers || isLoadingEmployees

  // Get unique users for dropdown
  const uniqueUsers = useMemo(() => {
    const users = new Set()
    userData.forEach(u => {
      if (u.user) users.add(u.user)
    })
    if (compareMode && compareData.length > 0) {
      compareData.forEach(u => {
        if (u.user) users.add(u.user)
      })
    }
    return Array.from(users).sort()
  }, [userData, compareData, compareMode])

  // CXO data processing - group by individual user
  const cxoUserData = useMemo(() => {
    if (cxoData.length === 0) return []
    
    // Group by user email
    const userMap = {}
    cxoData.forEach(u => {
      const email = u.user || u.email || 'Unknown'
      if (!userMap[email]) {
        userMap[email] = {
          user: email,
          'Team Chat': 0,
          'Private Chat': 0,
          'Calls': 0,
          'Meetings Org': 0,
          'Meetings Att': 0,
          'One-time Org': 0,
          'One-time Att': 0,
          'Recurring Org': 0,
          'Recurring Att': 0,
          'Post Messages': 0,
        }
      }
      userMap[email]['Team Chat'] += u['Team Chat'] || 0
      userMap[email]['Private Chat'] += u['Private Chat'] || 0
      userMap[email]['Calls'] += u['Calls'] || 0
      userMap[email]['Meetings Org'] += u['Meetings Org'] || 0
      userMap[email]['Meetings Att'] += u['Meetings Att'] || 0
      userMap[email]['One-time Org'] += u['One-time Org'] || 0
      userMap[email]['One-time Att'] += u['One-time Att'] || 0
      userMap[email]['Recurring Org'] += u['Recurring Org'] || 0
      userMap[email]['Recurring Att'] += u['Recurring Att'] || 0
      userMap[email]['Post Messages'] += u['Post Messages'] || 0
    })
    
    return Object.values(userMap).sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoData])

  const cxoCompareUserData = useMemo(() => {
    if (cxoCompareData.length === 0) return []
    
    // Group by user email
    const userMap = {}
    cxoCompareData.forEach(u => {
      const email = u.user || u.email || 'Unknown'
      if (!userMap[email]) {
        userMap[email] = {
          user: email,
          'Team Chat (Compare)': 0,
          'Private Chat (Compare)': 0,
          'Calls (Compare)': 0,
          'Meetings Org (Compare)': 0,
          'Meetings Att (Compare)': 0,
          'One-time Org (Compare)': 0,
          'One-time Att (Compare)': 0,
          'Recurring Org (Compare)': 0,
          'Recurring Att (Compare)': 0,
          'Post Messages (Compare)': 0,
        }
      }
      userMap[email]['Team Chat (Compare)'] += u['Team Chat'] || 0
      userMap[email]['Private Chat (Compare)'] += u['Private Chat'] || 0
      userMap[email]['Calls (Compare)'] += u['Calls'] || 0
      userMap[email]['Meetings Org (Compare)'] += u['Meetings Org'] || 0
      userMap[email]['Meetings Att (Compare)'] += u['Meetings Att'] || 0
      userMap[email]['One-time Org (Compare)'] += u['One-time Org'] || 0
      userMap[email]['One-time Att (Compare)'] += u['One-time Att'] || 0
      userMap[email]['Recurring Org (Compare)'] += u['Recurring Org'] || 0
      userMap[email]['Recurring Att (Compare)'] += u['Recurring Att'] || 0
      userMap[email]['Post Messages (Compare)'] += u['Post Messages'] || 0
    })
    
    return Object.values(userMap).sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoCompareData])

  // Merge CXO user data for comparison
  const cxoMergedUserData = useMemo(() => {
    if (!compareMode || !compareFileId) return cxoUserData

    // Create a map of user -> data for both files
    const file1Map = {}
    const file2Map = {}

    cxoUserData.forEach(u => {
      file1Map[u.user] = u
    })

    cxoCompareUserData.forEach(u => {
      file2Map[u.user] = u
    })

    // Get all users from both files
    const allUsers = new Set([...Object.keys(file1Map), ...Object.keys(file2Map)])

    // Create merged records
    const merged = []
    allUsers.forEach(user => {
      const file1Data = file1Map[user]
      const file2Data = file2Map[user]

      merged.push({
        user,
        'Team Chat': file1Data ? file1Data['Team Chat'] : 0,
        'Private Chat': file1Data ? file1Data['Private Chat'] : 0,
        'Calls': file1Data ? file1Data['Calls'] : 0,
        'Meetings Org': file1Data ? file1Data['Meetings Org'] : 0,
        'Meetings Att': file1Data ? file1Data['Meetings Att'] : 0,
        'One-time Org': file1Data ? file1Data['One-time Org'] : 0,
        'One-time Att': file1Data ? file1Data['One-time Att'] : 0,
        'Recurring Org': file1Data ? file1Data['Recurring Org'] : 0,
        'Recurring Att': file1Data ? file1Data['Recurring Att'] : 0,
        'Post Messages': file1Data ? file1Data['Post Messages'] : 0,
        'Team Chat (Compare)': file2Data ? file2Data['Team Chat (Compare)'] : 0,
        'Private Chat (Compare)': file2Data ? file2Data['Private Chat (Compare)'] : 0,
        'Calls (Compare)': file2Data ? file2Data['Calls (Compare)'] : 0,
        'Meetings Org (Compare)': file2Data ? file2Data['Meetings Org (Compare)'] : 0,
        'Meetings Att (Compare)': file2Data ? file2Data['Meetings Att (Compare)'] : 0,
        'One-time Org (Compare)': file2Data ? file2Data['One-time Org (Compare)'] : 0,
        'One-time Att (Compare)': file2Data ? file2Data['One-time Att (Compare)'] : 0,
        'Recurring Org (Compare)': file2Data ? file2Data['Recurring Org (Compare)'] : 0,
        'Recurring Att (Compare)': file2Data ? file2Data['Recurring Att (Compare)'] : 0,
        'Post Messages (Compare)': file2Data ? file2Data['Post Messages (Compare)'] : 0,
      })
    })

    return merged.sort((a, b) => a.user.localeCompare(b.user))
  }, [cxoUserData, cxoCompareUserData, compareMode, compareFileId])

  // Generate activity chart data for each CXO user
  const cxoUserActivityCharts = useMemo(() => {
    const dataToUse = cxoMergedUserData.length > 0 ? cxoMergedUserData : cxoUserData
    if (dataToUse.length === 0) return []

    const activities = [
      { key: 'Team Chat', label: 'Team Chat Message Count' },
      { key: 'Private Chat', label: 'Private Chat Message Count' },
      { key: 'Calls', label: 'Call Count' },
      { key: 'Meetings Org', label: 'Meetings Organized Count' },
      { key: 'Meetings Att', label: 'Meetings Attended Count' },
      { key: 'One-time Org', label: 'One-time Meetings Organized' },
      { key: 'One-time Att', label: 'One-time Meetings Attended' },
      { key: 'Recurring Org', label: 'Recurring Meetings Organized' },
      { key: 'Recurring Att', label: 'Recurring Meetings Attended' },
      { key: 'Post Messages', label: 'Post Messages' },
    ]

    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    const file1Label = file1 ? `${file1.from_month} to ${file1.to_month}` : 'File 1'
    const file2Label = file2 ? `${file2.from_month} to ${file2.to_month}` : 'File 2'

    return dataToUse.map(userData => {
      const chartData = activities.map(activity => {
        const result = {
          activity: activity.label,
        }

        result[file1Label] = userData[activity.key] || 0

        if (compareMode && compareFileId) {
          result[file2Label] = userData[`${activity.key} (Compare)`] || 0
        }

        return result
      })

      return {
        user: userData.user,
        chartData
      }
    })
  }, [cxoMergedUserData, cxoUserData, files, selectedFileId, compareFileId, compareMode])

  // Aggregate total activities (when no user selected)
  const totalActivities = useMemo(() => {
    if (selectedUser || userData.length === 0) return []
    
    const total = {
      user: 'Total Activities',
      'Team Chat': 0,
      'Private Chat': 0,
      'Calls': 0,
      'Meetings Org': 0,
      'Meetings Att': 0,
      'One-time Org': 0,
      'One-time Att': 0,
      'Recurring Org': 0,
      'Recurring Att': 0,
      'Post Messages': 0,
    }

    userData.forEach(u => {
      total['Team Chat'] += u['Team Chat'] || 0
      total['Private Chat'] += u['Private Chat'] || 0
      total['Calls'] += u['Calls'] || 0
      total['Meetings Org'] += u['Meetings Org'] || 0
      total['Meetings Att'] += u['Meetings Att'] || 0
      total['One-time Org'] += u['One-time Org'] || 0
      total['One-time Att'] += u['One-time Att'] || 0
      total['Recurring Org'] += u['Recurring Org'] || 0
      total['Recurring Att'] += u['Recurring Att'] || 0
      total['Post Messages'] += u['Post Messages'] || 0
    })

    return [total]
  }, [userData, selectedUser])

  const totalCompareActivities = useMemo(() => {
    if (selectedUser || compareData.length === 0) return []
    
    const total = {
      user: 'Total Activities',
      'Team Chat (Compare)': 0,
      'Private Chat (Compare)': 0,
      'Calls (Compare)': 0,
      'Meetings Org (Compare)': 0,
      'Meetings Att (Compare)': 0,
      'One-time Org (Compare)': 0,
      'One-time Att (Compare)': 0,
      'Recurring Org (Compare)': 0,
      'Recurring Att (Compare)': 0,
      'Post Messages (Compare)': 0,
    }

    compareData.forEach(u => {
      total['Team Chat (Compare)'] += u['Team Chat'] || 0
      total['Private Chat (Compare)'] += u['Private Chat'] || 0
      total['Calls (Compare)'] += u['Calls'] || 0
      total['Meetings Org (Compare)'] += u['Meetings Org'] || 0
      total['Meetings Att (Compare)'] += u['Meetings Att'] || 0
      total['One-time Org (Compare)'] += u['One-time Org'] || 0
      total['One-time Att (Compare)'] += u['One-time Att'] || 0
      total['Recurring Org (Compare)'] += u['Recurring Org'] || 0
      total['Recurring Att (Compare)'] += u['Recurring Att'] || 0
      total['Post Messages (Compare)'] += u['Post Messages'] || 0
    })

    return [total]
  }, [compareData, selectedUser])

  // Filter data by selected user
  const filteredData = useMemo(() => {
    if (!selectedUser) return totalActivities
    return userData.filter(u => u.user === selectedUser)
  }, [userData, selectedUser, totalActivities])

  const filteredCompareData = useMemo(() => {
    if (!selectedUser) return totalCompareActivities
    return compareData.filter(u => u.user === selectedUser)
  }, [compareData, selectedUser, totalCompareActivities])

  // Merge data for comparison
  const mergedData = useMemo(() => {
    if (!compareMode || !compareFileId) return filteredData

    if (!selectedUser) {
      // Merge totals
      const merged = [{
        user: 'Total Activities',
        ...totalActivities[0],
        ...totalCompareActivities[0]
      }]
      return merged
    }

    // Create a map of user -> data for both files
    const file1Map = {}
    const file2Map = {}

    filteredData.forEach(u => {
      file1Map[u.user] = u
    })

    filteredCompareData.forEach(u => {
      file2Map[u.user] = u
    })

    // Get all users from both files
    const allUsers = new Set([...Object.keys(file1Map), ...Object.keys(file2Map)])

    // Create merged records
    const merged = []
    allUsers.forEach(user => {
      const file1Data = file1Map[user]
      const file2Data = file2Map[user]

      // Create a record with both files' data
      merged.push({
        user,
        // File 1 data (original columns)
        'Team Chat': file1Data ? file1Data['Team Chat'] : 0,
        'Private Chat': file1Data ? file1Data['Private Chat'] : 0,
        'Calls': file1Data ? file1Data['Calls'] : 0,
        'Meetings Org': file1Data ? file1Data['Meetings Org'] : 0,
        'Meetings Att': file1Data ? file1Data['Meetings Att'] : 0,
        'One-time Org': file1Data ? file1Data['One-time Org'] : 0,
        'One-time Att': file1Data ? file1Data['One-time Att'] : 0,
        'Recurring Org': file1Data ? file1Data['Recurring Org'] : 0,
        'Recurring Att': file1Data ? file1Data['Recurring Att'] : 0,
        'Post Messages': file1Data ? file1Data['Post Messages'] : 0,
        // File 2 data (with different names for comparison)
        'Team Chat (Compare)': file2Data ? file2Data['Team Chat'] : 0,
        'Private Chat (Compare)': file2Data ? file2Data['Private Chat'] : 0,
        'Calls (Compare)': file2Data ? file2Data['Calls'] : 0,
        'Meetings Org (Compare)': file2Data ? file2Data['Meetings Org'] : 0,
        'Meetings Att (Compare)': file2Data ? file2Data['Meetings Att'] : 0,
        'One-time Org (Compare)': file2Data ? file2Data['One-time Org'] : 0,
        'One-time Att (Compare)': file2Data ? file2Data['One-time Att'] : 0,
        'Recurring Org (Compare)': file2Data ? file2Data['Recurring Org'] : 0,
        'Recurring Att (Compare)': file2Data ? file2Data['Recurring Att'] : 0,
        'Post Messages (Compare)': file2Data ? file2Data['Post Messages'] : 0,
      })
    })

    return merged.sort((a, b) => a.user.localeCompare(b.user))
  }, [filteredData, filteredCompareData, compareMode, compareFileId, selectedUser, totalActivities, totalCompareActivities])

  const chartData = compareMode ? mergedData : filteredData

  // Transform data for activity-based chart (activities on X-axis)
  const activityChartData = useMemo(() => {
    if (chartData.length === 0) return []

    const activities = [
      { key: 'Team Chat', label: 'Team Chat Message Count' },
      { key: 'Private Chat', label: 'Private Chat Message Count' },
      { key: 'Calls', label: 'Call Count' },
      { key: 'Meetings Org', label: 'Meetings Organized Count' },
      { key: 'Meetings Att', label: 'Meetings Attended Count' },
      { key: 'One-time Org', label: 'One-time Meetings Organized' },
      { key: 'One-time Att', label: 'One-time Meetings Attended' },
      { key: 'Recurring Org', label: 'Recurring Meetings Organized' },
      { key: 'Recurring Att', label: 'Recurring Meetings Attended' },
      { key: 'Post Messages', label: 'Post Messages' },
    ]

    // Get file info for legend labels
    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === compareFileId)
    const file1Label = file1 ? `${file1.from_month} to ${file1.to_month}` : 'File 1'
    const file2Label = file2 ? `${file2.from_month} to ${file2.to_month}` : 'File 2'

    return activities.map(activity => {
      const result = {
        activity: activity.label,
      }

      // Sum values from all users for this activity
      chartData.forEach(user => {
        if (!result[file1Label]) result[file1Label] = 0
        result[file1Label] += user[activity.key] || 0

        if (compareMode && compareFileId) {
          if (!result[file2Label]) result[file2Label] = 0
          result[file2Label] += user[`${activity.key} (Compare)`] || 0
        }
      })

      return result
    })
  }, [chartData, files, selectedFileId, compareFileId, compareMode])

  // Transform Function data for charts (Functions on Y-axis, activities as bars)
  const functionChartData = useMemo(() => {
    if (functionData.length === 0) return []

    // Transform to have functions on Y-axis
    return functionData.map(func => ({
      function: func.function,
      'Team Chat': func['Team Chat'] || 0,
      'Private Chat': func['Private Chat'] || 0,
      'Calls': func['Calls'] || 0,
      'Meetings Org': func['Meetings Org'] || 0,
      'Meetings Att': func['Meetings Att'] || 0,
      'One-time Org': func['One-time Org'] || 0,
      'One-time Att': func['One-time Att'] || 0,
      'Recurring Org': func['Recurring Org'] || 0,
      'Recurring Att': func['Recurring Att'] || 0,
      'Post Messages': func['Post Messages'] || 0,
    })).sort((a, b) => b['Private Chat'] - a['Private Chat']) // Sort by highest activity
  }, [functionData])

  // Transform Company data for charts (Companies on Y-axis, activities as bars)
  const companyChartData = useMemo(() => {
    if (companyData.length === 0) return []

    // Transform to have companies on Y-axis
    return companyData.map(comp => ({
      company: comp.company,
      'Team Chat': comp['Team Chat'] || 0,
      'Private Chat': comp['Private Chat'] || 0,
      'Calls': comp['Calls'] || 0,
      'Meetings Org': comp['Meetings Org'] || 0,
      'Meetings Att': comp['Meetings Att'] || 0,
      'One-time Org': comp['One-time Org'] || 0,
      'One-time Att': comp['One-time Att'] || 0,
      'Recurring Org': comp['Recurring Org'] || 0,
      'Recurring Att': comp['Recurring Att'] || 0,
      'Post Messages': comp['Post Messages'] || 0,
    })).sort((a, b) => b['Private Chat'] - a['Private Chat']) // Sort by highest activity
  }, [companyData])

  // Get file labels for legend
  const fileLabels = useMemo(() => {
    const file1 = files.find(f => f.id === selectedFileId)
    const file2 = files.find(f => f.id === groupCompareFileId)
    return {
      file1Label: file1 ? `${file1.from_month} to ${file1.to_month}` : 'File 1',
      file2Label: file2 ? `${file2.from_month} to ${file2.to_month}` : 'File 2'
    }
  }, [files, selectedFileId, groupCompareFileId])

  const exportToPDF = async () => {
    setIsExporting(true)
    
    try {
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Get all activity chart elements
      const activityElements = []
      
      if (activeTab === 'user') {
        // For user-wise, capture the main chart
        const chartCard = chartRef.current?.querySelector('.card')
        if (chartCard) {
          activityElements.push({
            element: chartCard,
            title: selectedUser ? `Activity for ${selectedUser}` : 'All Activities'
          })
        }
      } else {
        // For function/company-wise, capture each activity bar chart
        const activityTitles = [
          'Private Chat', 'Team Chat', 'Meetings Attended', 'Meetings Organized',
          'Calls', 'One-time Meetings Attended', 'One-time Meetings Organized',
          'Recurring Meetings Attended', 'Recurring Meetings Organized', 'Post Messages'
        ]
        
        // Find the card containing activities
        const activityCard = chartRef.current?.querySelector('#activity-charts-container')
        if (activityCard && activityCard.children) {
          const activityContainers = activityCard.children
          Array.from(activityContainers).forEach((container, idx) => {
            if (idx < activityTitles.length) {
              activityElements.push({
                element: container,
                title: activityTitles[idx]
              })
            }
          })
        }
      }
      
      if (activityElements.length === 0) {
        throw new Error('No charts found to export')
      }
      
      // Export each activity to a separate page
      for (let i = 0; i < activityElements.length; i++) {
        const { element, title } = activityElements[i]
        
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 10000,
          letterRendering: true
        })
        
        // Use JPEG with compression to avoid string length errors
        const imgData = canvas.toDataURL('image/jpeg', 0.85)
        const imgWidth = pdfWidth - 20
        const imgHeight = (canvas.height * imgWidth) / canvas.width
        
        if (i > 0) pdf.addPage()
        
        // Add title
        pdf.setFontSize(18)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(40, 40, 40)
        pdf.text(title, pdfWidth / 2, 15, { align: 'center' })
        
        // Add chart
        let yPos = 25
        if (imgHeight > pdfHeight - 30) {
          const scaledHeight = pdfHeight - 30
          const scaledWidth = (canvas.width * scaledHeight) / canvas.height
          pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, yPos, scaledWidth, scaledHeight)
        } else {
          pdf.addImage(imgData, 'JPEG', 10, yPos, imgWidth, imgHeight)
        }
      }
      
      const fileName = `Teams_User_Activity_${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName)
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Exporting PDF...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div className="bg-blue-600 h-4 rounded-full transition-all duration-300 w-full animate-pulse" />
            </div>
            <p className="text-sm text-gray-600 text-center">Please wait...</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">User Activity</h2>
          <p className="text-gray-600 mt-1">View MS Teams user activity metrics</p>
        </div>
        <button
          onClick={exportToPDF}
          disabled={isExporting}
          className="btn flex items-center gap-2"
        >
          <span className="lnr lnr-download"></span>
          <span>{isExporting ? 'Exporting...' : 'Export as PDF'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="card">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('user')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'user'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              User-wise
            </button>
            <button
              onClick={() => setActiveTab('function')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'function'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Function-wise
            </button>
            <button
              onClick={() => setActiveTab('company')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'company'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Company-wise
            </button>
            <button
              onClick={() => setActiveTab('cxo')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'cxo'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              CXO Comparison
            </button>
          </nav>
        </div>
      </div>

      {/* User-wise Filters */}
      {activeTab === 'user' && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={compareMode}
                onChange={(e) => {
                  setCompareMode(e.target.checked)
                  if (!e.target.checked) setCompareFileId(null)
                }}
                className="form-checkbox h-4 w-4 text-blue-600 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Enable Comparison Mode</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="fileSelect" className="block text-sm font-medium text-gray-700 mb-1">
                {compareMode ? 'Teams File 1' : 'Teams File'}
              </label>
              <select
                id="fileSelect"
                value={selectedFileId || ''}
                onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select w-full"
              >
                <option value="">All Files</option>
                {files.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                  </option>
                ))}
              </select>
            </div>

            {compareMode && (
              <div>
                <label htmlFor="compareFileSelect" className="block text-sm font-medium text-gray-700 mb-1">Teams File 2</label>
                <select
                  id="compareFileSelect"
                  value={compareFileId || ''}
                  onChange={(e) => setCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                  className="form-select w-full border-2 border-blue-300"
                >
                  <option value="">Select file to compare</option>
                  {files.filter(f => f.id !== selectedFileId).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="userSelect" className="block text-sm font-medium text-gray-700 mb-1">Filter by User Email</label>
              <select
                id="userSelect"
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="form-select w-full"
              >
                <option value="">All Users ({uniqueUsers.length})</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Function/Company-wise Filters */}
      {(activeTab === 'function' || activeTab === 'company') && (
        <div className="card p-4 space-y-4">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={groupCompareMode}
                onChange={(e) => {
                  setGroupCompareMode(e.target.checked)
                  if (!e.target.checked) setGroupCompareFileId(null)
                }}
                className="form-checkbox h-4 w-4 text-blue-600 rounded"
              />
              <span className="ml-2 text-sm font-medium text-gray-700">Enable Comparison Mode</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="teamsFileSelect2" className="block text-sm font-medium text-gray-700 mb-1">
                {groupCompareMode ? 'Teams File 1' : 'Teams Activity File'}
              </label>
              <select
                id="teamsFileSelect2"
                value={selectedFileId || ''}
                onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select w-full"
              >
                <option value="">Select Teams file</option>
                {files.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                  </option>
                ))}
              </select>
            </div>

            {groupCompareMode && (
              <div>
                <label htmlFor="groupCompareFileSelect" className="block text-sm font-medium text-gray-700 mb-1">Teams File 2</label>
                <select
                  id="groupCompareFileSelect"
                  value={groupCompareFileId || ''}
                  onChange={(e) => setGroupCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                  className="form-select w-full border-2 border-blue-300"
                >
                  <option value="">Select file to compare</option>
                  {files.filter(f => f.id !== selectedFileId).map(f => (
                    <option key={f.id} value={f.id}>
                      {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="employeeFileSelect" className="block text-sm font-medium text-gray-700 mb-1">Employee List File</label>
              <select
                id="employeeFileSelect"
                value={selectedEmployeeFileId || ''}
                onChange={(e) => setSelectedEmployeeFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="form-select w-full"
              >
                <option value="">Select employee file</option>
                {employeeFiles.map(f => (
                  <option key={f.id} value={f.id}>
                    {f.filename}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section with ref for PDF export */}
      <div ref={chartRef}>
        {/* Summary Stats - User-wise only */}
        {activeTab === 'user' && filteredData.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="card p-4 border-l-4 border-blue-500">
            <p className="text-sm text-gray-600">Team Chats</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Team Chat'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-green-500">
            <p className="text-sm text-gray-600">Private Chats</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Private Chat'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-orange-500">
            <p className="text-sm text-gray-600">Calls</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Calls'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-purple-500">
            <p className="text-sm text-gray-600">Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Meetings Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-pink-500">
            <p className="text-sm text-gray-600">Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Meetings Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-teal-500">
            <p className="text-sm text-gray-600">One-time Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['One-time Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-cyan-500">
            <p className="text-sm text-gray-600">One-time Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['One-time Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-indigo-500">
            <p className="text-sm text-gray-600">Recurring Meetings Organized</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Recurring Org'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-violet-500">
            <p className="text-sm text-gray-600">Recurring Meetings Attended</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Recurring Att'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
          <div className="card p-4 border-l-4 border-red-500">
            <p className="text-sm text-gray-600">Post Messages</p>
            <p className="text-2xl font-bold text-gray-900">{filteredData.reduce((sum, d) => sum + (d['Post Messages'] || 0), 0).toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedUser ? '1 user(s)' : `${uniqueUsers.length} user(s)`}</p>
          </div>
        </div>
      )}

      {filteredData.length === 0 && activeTab === 'user' && !isLoading && (
        <div className="card p-6 text-center text-gray-600">
          <p>No data available. {userData.length > 0 ? 'Try adjusting your filters.' : 'Please upload Teams activity files first.'}</p>
        </div>
      )}

      {/* User-wise Chart */}
      {activeTab === 'user' && activityChartData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {selectedUser ? `Activity for ${selectedUser}` : 'All Activities'}
          </h3>
          <div style={{ width: '100%', height: 500 }}>
            <ResponsiveContainer>
              <BarChart data={activityChartData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis 
                  dataKey="activity" 
                  angle={-45} 
                  textAnchor="end" 
                  height={120}
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={{ stroke: '#d1d5db' }}
                  interval={0}
                />
                <YAxis 
                  label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                  tick={{ fontSize: 11, fill: '#6b7280' }} 
                  axisLine={{ stroke: '#d1d5db' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
                  }} 
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '10px' }}
                  iconType="square"
                />
                
                {/* Determine the file labels dynamically */}
                {(() => {
                  const allKeys = Object.keys(activityChartData[0] || {}).filter(k => k !== 'activity')
                  const file1Key = allKeys[0]
                  const file2Key = allKeys[1]
                  
                  return (
                    <>
                      {file1Key && (
                        <Bar 
                          key={file1Key}
                          dataKey={file1Key} 
                          name={file1Key}
                          fill="#f97316" 
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey={file1Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                        </Bar>
                      )}
                      
                      {compareMode && compareFileId && file2Key && (
                        <Bar 
                          key={file2Key}
                          dataKey={file2Key} 
                          name={file2Key}
                          fill="#3b82f6" 
                          radius={[8, 8, 0, 0]}
                        >
                          <LabelList dataKey={file2Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                        </Bar>
                      )}
                    </>
                  )
                })()}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Function-wise Chart - Custom HTML Bars */}
      {activeTab === 'function' && functionData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Function-wise Activity</h3>
          <p className="text-sm text-gray-600 mb-4">{functionData.length} functions</p>
          
          <div className="space-y-10" id="activity-charts-container">
            <ActivityBar 
              title="Private Chat" 
              color="#10b981" 
              lightColor="#6ee7b7"
              dataKey="Private Chat" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Team Chat" 
              color="#3b82f6" 
              lightColor="#60a5fa"
              dataKey="Team Chat" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Meetings Attended" 
              color="#ec4899" 
              lightColor="#f9a8d4"
              dataKey="Meetings Att" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Meetings Organized" 
              color="#8b5cf6" 
              lightColor="#a78bfa"
              dataKey="Meetings Org" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Calls" 
              color="#f59e0b" 
              lightColor="#fbbf24"
              dataKey="Calls" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="One-time Meetings Attended" 
              color="#f97316" 
              lightColor="#fb923c"
              dataKey="One-time Att" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="One-time Meetings Organized" 
              color="#06b6d4" 
              lightColor="#22d3ee"
              dataKey="One-time Org" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Recurring Meetings Attended" 
              color="#6366f1" 
              lightColor="#818cf8"
              dataKey="Recurring Att" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Recurring Meetings Organized" 
              color="#14b8a6" 
              lightColor="#2dd4bf"
              dataKey="Recurring Org" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Post Messages" 
              color="#ef4444" 
              lightColor="#f87171"
              dataKey="Post Messages" 
              data={functionData} 
              compareData={functionCompareData}
              groupKey="function"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
          </div>
        </div>
      )}

      {activeTab === 'function' && functionData.length === 0 && !isLoading && (
        <div className="card p-6 text-center text-gray-600">
          <p>No function data available. Please select both Teams activity file and Employee list file.</p>
        </div>
      )}

      {/* Company-wise Chart - Custom HTML Bars */}
      {activeTab === 'company' && companyData.length > 0 && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Company-wise Activity</h3>
          <p className="text-sm text-gray-600 mb-4">{companyData.length} companies</p>

          <div className="space-y-10" id="activity-charts-container">
            <ActivityBar 
              title="Private Chat" 
              color="#10b981" 
              lightColor="#6ee7b7"
              dataKey="Private Chat" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Team Chat" 
              color="#3b82f6" 
              lightColor="#60a5fa"
              dataKey="Team Chat" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Meetings Attended" 
              color="#ec4899" 
              lightColor="#f9a8d4"
              dataKey="Meetings Att" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Meetings Organized" 
              color="#8b5cf6" 
              lightColor="#a78bfa"
              dataKey="Meetings Org" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Calls" 
              color="#f59e0b" 
              lightColor="#fbbf24"
              dataKey="Calls" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="One-time Meetings Attended" 
              color="#f97316" 
              lightColor="#fb923c"
              dataKey="One-time Att" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="One-time Meetings Organized" 
              color="#06b6d4" 
              lightColor="#22d3ee"
              dataKey="One-time Org" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Recurring Meetings Attended" 
              color="#6366f1" 
              lightColor="#818cf8"
              dataKey="Recurring Att" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Recurring Meetings Organized" 
              color="#14b8a6" 
              lightColor="#2dd4bf"
              dataKey="Recurring Org" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
            <ActivityBar 
              title="Post Messages" 
              color="#ef4444" 
              lightColor="#f87171"
              dataKey="Post Messages" 
              data={companyData} 
              compareData={companyCompareData}
              groupKey="company"
              compareMode={groupCompareMode && groupCompareFileId}
              file1Label={fileLabels.file1Label}
              file2Label={fileLabels.file2Label}
            />
          </div>
        </div>
      )}

      {/* CXO Comparison Tab */}
      {activeTab === 'cxo' && (
        <>
          {/* CXO Filters */}
          <div className="card p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={compareMode}
                    onChange={(e) => {
                      setCompareMode(e.target.checked)
                      if (!e.target.checked) setCompareFileId(null)
                    }}
                    className="form-checkbox h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-700">Enable Comparison Mode</span>
                </label>
              </div>
              <button
                onClick={() => setShowCXOManagement(!showCXOManagement)}
                className="btn btn-sm"
              >
                {showCXOManagement ? 'Hide' : 'Manage'} CXO Users
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cxoFileSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  {compareMode ? 'Teams File 1' : 'Teams File'}
                </label>
                <select
                  id="cxoFileSelect"
                  value={selectedFileId || ''}
                  onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
                  className="form-select w-full"
                >
                  <option value="">All Files</option>
                  {files.map(f => (
                    <option key={f.id} value={f.id}>
                      {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                    </option>
                  ))}
                </select>
              </div>

              {compareMode && (
                <div>
                  <label htmlFor="cxoCompareFileSelect" className="block text-sm font-medium text-gray-700 mb-1">Teams File 2</label>
                  <select
                    id="cxoCompareFileSelect"
                    value={compareFileId || ''}
                    onChange={(e) => setCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                    className="form-select w-full border-2 border-blue-300"
                  >
                    <option value="">Select file to compare</option>
                    {files.filter(f => f.id !== selectedFileId).map(f => (
                      <option key={f.id} value={f.id}>
                        {f.filename} ({f.from_month && f.to_month ? `${f.from_month} to ${f.to_month}` : f.from_month || f.to_month || 'No date range'})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* CXO Management UI */}
            {showCXOManagement && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-semibold text-gray-800 mb-3">Mark Employees as CXO</h4>
                
                {employeeFiles.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Please upload an Employee List file first to mark employees as CXO.
                  </p>
                ) : (
                  <>
                    <div className="mb-4">
                      <label htmlFor="employeeFileForCXO" className="block text-sm font-medium text-gray-700 mb-1">
                        Select Employee File
                      </label>
                      <select
                        id="employeeFileForCXO"
                        value={selectedEmployeeFileForCXO || ''}
                        onChange={(e) => setSelectedEmployeeFileForCXO(e.target.value ? parseInt(e.target.value) : null)}
                        className="form-select w-full"
                      >
                        <option value="">All Employee Files</option>
                        {employeeFiles.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.filename}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <div className="mb-3">
                        <label htmlFor="cxoSearch" className="block text-sm font-medium text-gray-700 mb-1">
                          Search Employees
                        </label>
                        <input
                          type="text"
                          id="cxoSearch"
                          value={cxoSearchQuery}
                          onChange={(e) => setCxoSearchQuery(e.target.value)}
                          placeholder="Search by name, email, function, or company..."
                          className="form-input w-full"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">
                          Employees ({(() => {
                            const filtered = employeesWithCXO.filter(emp => {
                              if (!cxoSearchQuery.trim()) return true
                              const query = cxoSearchQuery.toLowerCase()
                              return (
                                (emp.name && emp.name.toLowerCase().includes(query)) ||
                                (emp.email && emp.email.toLowerCase().includes(query)) ||
                                (emp.function && emp.function.toLowerCase().includes(query)) ||
                                (emp.company && emp.company.toLowerCase().includes(query))
                              )
                            })
                            return filtered.length
                          })()})
                        </label>
                        <span className="text-xs text-gray-500">
                          {employeesWithCXO.filter(e => e.is_cxo).length} marked as CXO
                        </span>
                      </div>
                      <div className="max-h-96 overflow-y-auto border border-gray-200 rounded p-2 bg-white">
                        {isLoadingEmployees ? (
                          <p className="text-sm text-gray-500 text-center py-4">Loading employees...</p>
                        ) : employeesWithCXO.length === 0 ? (
                          <p className="text-sm text-gray-500 text-center py-4">No employees found in selected file(s)</p>
                        ) : (() => {
                          const filteredEmployees = employeesWithCXO.filter(emp => {
                            if (!cxoSearchQuery.trim()) return true
                            const query = cxoSearchQuery.toLowerCase()
                            return (
                              (emp.name && emp.name.toLowerCase().includes(query)) ||
                              (emp.email && emp.email.toLowerCase().includes(query)) ||
                              (emp.function && emp.function.toLowerCase().includes(query)) ||
                              (emp.company && emp.company.toLowerCase().includes(query))
                            )
                          })
                          
                          if (filteredEmployees.length === 0) {
                            return (
                              <p className="text-sm text-gray-500 text-center py-4">
                                No employees found matching "{cxoSearchQuery}"
                              </p>
                            )
                          }
                          
                          return (
                            <div className="space-y-1">
                              {filteredEmployees.map((employee, idx) => (
                                <div key={idx} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <input
                                      type="checkbox"
                                      checked={employee.is_cxo}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          markCXOMutation.mutate(employee.email)
                                        } else {
                                          unmarkCXOMutation.mutate(employee.email)
                                        }
                                      }}
                                      disabled={markCXOMutation.isLoading || unmarkCXOMutation.isLoading}
                                      className="form-checkbox h-4 w-4 text-blue-600 rounded"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-sm font-medium text-gray-900 truncate">
                                        {employee.name || employee.email}
                                      </div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {employee.email}
                                        {employee.function && ` • ${employee.function}`}
                                        {employee.company && ` • ${employee.company}`}
                                      </div>
                                    </div>
                                  </div>
                                  {employee.is_cxo && (
                                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                                      CXO
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Individual CXO Activity Charts */}
          {cxoUserActivityCharts.length > 0 && (
            <div className="space-y-6">
              {cxoUserActivityCharts.map((userChart, idx) => {
                const file1 = files.find(f => f.id === selectedFileId)
                const file2 = files.find(f => f.id === compareFileId)
                const file1Label = file1 ? `${file1.from_month} to ${file1.to_month}` : 'File 1'
                const file2Label = file2 ? `${file2.from_month} to ${file2.to_month}` : 'File 2'
                const allKeys = Object.keys(userChart.chartData[0] || {}).filter(k => k !== 'activity')
                const file1Key = allKeys[0]
                const file2Key = allKeys[1]

                return (
                  <div key={idx} className="card p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">
                      {userChart.user}
                    </h3>
                    <div style={{ width: '100%', height: 400 }}>
                      <ResponsiveContainer>
                        <BarChart data={userChart.chartData} margin={{ top: 30, right: 30, left: 60, bottom: 100 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis 
                            dataKey="activity" 
                            angle={-45} 
                            textAnchor="end" 
                            height={120}
                            tick={{ fontSize: 10, fill: '#6b7280' }}
                            axisLine={{ stroke: '#d1d5db' }}
                            interval={0}
                          />
                          <YAxis 
                            label={{ value: 'Count', angle: -90, position: 'insideLeft', style: { fill: '#6b7280' } }}
                            tick={{ fontSize: 11, fill: '#6b7280' }} 
                            axisLine={{ stroke: '#d1d5db' }} 
                          />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'white', 
                              border: '1px solid #e5e7eb', 
                              borderRadius: '8px', 
                              boxShadow: '0 4px 6px rgba(0,0,0,0.1)' 
                            }} 
                          />
                          <Legend 
                            wrapperStyle={{ paddingTop: '10px' }}
                            iconType="square"
                          />
                          
                          {file1Key && (
                            <Bar 
                              key={file1Key}
                              dataKey={file1Key} 
                              name={file1Key}
                              fill="#f97316" 
                              radius={[8, 8, 0, 0]}
                            >
                              <LabelList dataKey={file1Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                            </Bar>
                          )}
                          
                          {compareMode && compareFileId && file2Key && (
                            <Bar 
                              key={file2Key}
                              dataKey={file2Key} 
                              name={file2Key}
                              fill="#3b82f6" 
                              radius={[8, 8, 0, 0]}
                            >
                              <LabelList dataKey={file2Key} position="top" style={{ fill: '#374151', fontSize: 11, fontWeight: 600 }} />
                            </Bar>
                          )}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {cxoUserActivityCharts.length === 0 && !isLoading && (
            <div className="card p-6 text-center text-gray-600">
              <p>No CXO activity data available. {cxoUsers.length === 0 ? 'Please mark employees as CXO first.' : 'Please upload Teams activity files and mark employees as CXO.'}</p>
            </div>
          )}
        </>
      )}
      </div>
    </div>
  )
}
