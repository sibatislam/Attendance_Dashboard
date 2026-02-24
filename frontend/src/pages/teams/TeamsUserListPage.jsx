import { useState, useMemo, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTeamsLicense } from '../../hooks/useTeamsLicense'
import { uploadTeamsUserList, getLatestTeamsUserList } from '../../lib/api'
import DataTable from '../../components/DataTable'

const STORAGE_KEY = 'teams_user_list_result'

export default function TeamsUserListPage() {
  const queryClient = useQueryClient()
  const [license, updateLicense, updateMutation] = useTeamsLicense()
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  // Load from DB on mount; fallback to localStorage for initial paint / offline
  const [result, setResult] = useState(() => {
    try {
      const s = localStorage.getItem(STORAGE_KEY)
      return s ? JSON.parse(s) : null
    } catch {
      return null
    }
  })

  // Fetch latest Teams User List from database so the list always persists (no disappearing)
  const { data: latestFromDb } = useQuery({
    queryKey: ['teams_user_list_latest'],
    queryFn: getLatestTeamsUserList,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  })

  useEffect(() => {
    if (latestFromDb && (latestFromDb.rows?.length || latestFromDb.total_assigned != null)) {
      const payload = {
        total_assigned: latestFromDb.total_assigned,
        by_sheet: latestFromDb.by_sheet || {},
        total_teams: latestFromDb.total_teams ?? 0,
        free: latestFromDb.free ?? 0,
        rows: latestFromDb.rows || [],
      }
      setResult(payload)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // ignore
      }
    }
  }, [latestFromDb])

  // Keep localStorage in sync when result changes (e.g. after upload)
  useEffect(() => {
    if (result != null) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result))
      } catch {
        // ignore quota / private mode
      }
    }
  }, [result])

  const [totalTeamsInput, setTotalTeamsInput] = useState('')
  const totalTeams = result != null && totalTeamsInput !== ''
    ? (parseInt(totalTeamsInput, 10) || 0)
    : (result?.total_teams ?? license.totalTeams)
  const totalAssigned = result?.total_assigned ?? license.totalAssigned
  const free = Math.max(0, (parseInt(totalTeams, 10) || 0) - (parseInt(totalAssigned, 10) || 0))

  const applyResult = (data) => {
    setResult(data)
    if (data?.total_teams != null && totalTeamsInput === '') setTotalTeamsInput(String(data.total_teams))
  }

  const handleFileChange = (e) => {
    const f = e.target.files?.[0]
    setFile(f || null)
    setUploadError(null)
    // keep previous result/list visible until next successful upload
  }

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const data = await uploadTeamsUserList(file)
      applyResult({
        total_assigned: data.total_assigned,
        by_sheet: data.by_sheet || {},
        total_teams: data.total_teams,
        free: data.free,
        rows: data.rows || [],
      })
      queryClient.invalidateQueries({ queryKey: ['teams_user_list_latest'] })
    } catch (err) {
      setUploadError(err?.response?.data?.detail || err?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const tableColumns = useMemo(() => {
    if (!result?.rows?.length) return []
    const order = ['S.No', 'Sheet', 'Name', 'Email', 'Designation', 'Department', 'Function']
    const first = result.rows[0]
    const keys = order.filter(k => k in first)
    const rest = Object.keys(first).filter(k => !order.includes(k))
    return [...keys, ...rest].map(key => ({ key, label: key, sortable: true }))
  }, [result?.rows])

  const downloadAsExcel = () => {
    if (!result?.rows?.length) return
    const colOrder = ['S.No', 'Sheet', 'Name', 'Email', 'Designation', 'Department', 'Function']
    const first = result.rows[0]
    const allKeys = [...colOrder.filter(k => k in first), ...Object.keys(first).filter(k => !colOrder.includes(k))]
    const escape = (v) => {
      const s = String(v ?? '')
      if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
      return s
    }
    const header = allKeys.map(escape).join(',')
    const csvRows = result.rows.map(row =>
      allKeys.map(k => escape(row[k])).join(',')
    )
    const csv = [header, ...csvRows].join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Teams_User_List_${result.rows.length}_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleUpdateLicense = () => {
    const t = parseInt(totalTeams, 10) || 0
    const a = parseInt(totalAssigned, 10) || 0
    const f = Math.max(0, t - a)
    updateLicense({ totalTeams: t, totalAssigned: a, free: f, perLicenseCost: license.perLicenseCost ?? null })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">MS Teams User List</h2>
        <p className="text-gray-600 mt-1">
          Upload an Excel file containing <strong>Teams</strong> and <strong>CBL_Teams</strong> sheets. 
          The system will count assigned users and auto-calculate Total Teams license, Total assigned license, and Free license.
        </p>
      </div>

      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-3">Upload file</h3>
        <p className="text-sm text-gray-500 mb-3">
          Use an Excel file (.xlsx) with sheet names <strong>Teams</strong> and <strong>CBL_Teams</strong> (e.g. Teams &amp; Office License - CIPLC.xlsx).
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select file</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!file || uploading}
            className="btn disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? 'Processing...' : 'Upload & calculate'}
          </button>
        </div>
        {uploadError && (
          <p className="mt-3 text-sm text-red-600">{uploadError}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-6 bg-sky-50 border border-sky-200">
          <div className="text-sm font-medium text-gray-700">Total Teams license</div>
          {result ? (
            <>
              <input
                type="number"
                min="0"
                value={totalTeamsInput !== '' ? totalTeamsInput : String(totalTeams)}
                onChange={(e) => setTotalTeamsInput(e.target.value)}
                className="mt-1 w-full max-w-[120px] border border-sky-300 rounded px-2 py-1 text-xl font-bold text-sky-800 bg-white"
              />
              <p className="text-xs text-gray-500 mt-1">Adjust if needed, then click Update license below</p>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-sky-800 mt-1">{totalTeams}</div>
              <p className="text-xs text-gray-500 mt-1">From license settings</p>
            </>
          )}
        </div>
        <div className="card p-6 bg-emerald-50 border border-emerald-200">
          <div className="text-sm font-medium text-gray-700">Total assigned license</div>
          <div className="text-2xl font-bold text-emerald-800 mt-1">{totalAssigned}</div>
          {result?.by_sheet && Object.keys(result.by_sheet).length > 0 && (
            <p className="text-xs text-gray-500 mt-1">
              From file: {Object.entries(result.by_sheet).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </p>
          )}
        </div>
        <div className="card p-6 bg-violet-50 border border-violet-200">
          <div className="text-sm font-medium text-gray-700">Free license</div>
          <div className="text-2xl font-bold text-violet-800 mt-1">{free}</div>
          <p className="text-xs text-gray-500 mt-1">Auto-calculated: Total − Assigned</p>
        </div>
      </div>

      {/* User list: show table when we have rows, otherwise show why it's empty */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-2">User list</h3>
        {result?.rows?.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm text-gray-500">
                {result.rows.length} user(s) from Teams and CBL_Teams sheets.
              </p>
              <button
                type="button"
                onClick={downloadAsExcel}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 border border-emerald-700 rounded-md hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                Download as Excel
              </button>
            </div>
            <DataTable columns={tableColumns} rows={result.rows} />
          </>
        ) : result ? (
          <p className="text-sm text-gray-500">
            No user rows in the last upload. Upload an Excel file with <strong>Teams</strong> and <strong>CBL_Teams</strong> sheets that contain user data to see the merged list here.
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            The table will appear here after you upload an Excel file above. Choose a file with <strong>Teams</strong> and <strong>CBL_Teams</strong> sheets, then click <strong>Upload &amp; calculate</strong>.
          </p>
        )}
      </div>

      {result && (
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Update license settings</h3>
          <p className="text-sm text-gray-500 mb-3">
            Save these values to Teams License so they appear on User Activity and Teams App Activity dashboards.
          </p>
          <button
            type="button"
            onClick={handleUpdateLicense}
            disabled={updateMutation?.isPending}
            className="btn disabled:opacity-50"
          >
            {updateMutation?.isPending ? 'Saving...' : 'Update license from file'}
          </button>
          {updateMutation?.isSuccess && (
            <span className="ml-3 text-sm text-green-600 font-medium">Saved.</span>
          )}
          {updateMutation?.isError && (
            <span className="ml-3 text-sm text-red-600">
              {updateMutation.error?.response?.data?.detail || 'Failed to save'}
            </span>
          )}
        </div>
      )}

      {!result && !uploadError && (
        <div className="card p-6 bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-600">
            Upload an Excel file above to see Total assigned license and the <strong>User list</strong> table from the <strong>Teams</strong> and <strong>CBL_Teams</strong> sheets. 
            Total Teams license is taken from current license settings; after upload you can update it to match your file or keep the existing value.
          </p>
        </div>
      )}
    </div>
  )
}
