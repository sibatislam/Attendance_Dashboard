import { useState, useEffect } from 'react'
import { useTeamsLicense } from '../../hooks/useTeamsLicense'

export default function TeamsLicensePage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isAdmin = user.role === 'admin'
  const permissions = user.permissions?.teams_dashboard || {}
  const features = permissions.features || []
  const canEdit = isAdmin || features.includes('license_edit')
  const canView = isAdmin || features.includes('license_entry') || features.includes('license_edit')
  
  const [license, updateLicense, updateMutation] = useTeamsLicense()
  const [totalTeams, setTotalTeams] = useState(String(license.totalTeams))
  const [totalAssigned, setTotalAssigned] = useState(String(license.totalAssigned))
  const [saved, setSaved] = useState(false)

  // Auto-calculate free license: Total Teams - Total Assigned
  const calculatedFree = Math.max(0, (parseInt(totalTeams, 10) || 0) - (parseInt(totalAssigned, 10) || 0))

  useEffect(() => {
    setTotalTeams(String(license.totalTeams))
    setTotalAssigned(String(license.totalAssigned))
  }, [license.totalTeams, license.totalAssigned])

  // Handle successful save
  useEffect(() => {
    if (updateMutation?.isSuccess) {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
  }, [updateMutation?.isSuccess])

  const handleSubmit = (e) => {
    e.preventDefault()
    const t = parseInt(totalTeams, 10) || 0
    const a = parseInt(totalAssigned, 10) || 0
    // Free is auto-calculated: Total - Assigned
    const f = Math.max(0, t - a)
    updateLicense({
      totalTeams: t,
      totalAssigned: a,
      free: f,
    })
  }

  if (!canView) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">You don't have permission to view Teams license information.</p>
          <p className="text-sm text-gray-500 mt-2">Please contact your administrator for access.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Teams License Settings</h2>
        <p className="text-gray-600 mt-1">
          {canEdit 
            ? 'Enter Total Teams license, Total assigned license, and Free license. These values appear on User Activity and Teams App Activity.'
            : 'View Teams license information. Contact an administrator to edit these values.'}
        </p>
      </div>

      <div className="card p-6 max-w-xl">
        <div className="space-y-4">
          <div>
            <label htmlFor="totalTeams" className="block text-sm font-medium text-gray-700 mb-1">
              Total Teams license
            </label>
            <input
              id="totalTeams"
              type="number"
              min="0"
              value={totalTeams}
              onChange={(e) => setTotalTeams(e.target.value)}
              disabled={!canEdit}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 ${canEdit ? 'bg-white/80' : 'bg-gray-100 cursor-not-allowed'}`}
              placeholder="e.g. 500"
            />
          </div>
          <div>
            <label htmlFor="totalAssigned" className="block text-sm font-medium text-gray-700 mb-1">
              Total assigned license
            </label>
            <input
              id="totalAssigned"
              type="number"
              min="0"
              value={totalAssigned}
              onChange={(e) => setTotalAssigned(e.target.value)}
              disabled={!canEdit}
              className={`w-full border border-gray-300 rounded-md px-3 py-2 ${canEdit ? 'bg-white/80' : 'bg-gray-100 cursor-not-allowed'}`}
              placeholder="e.g. 420"
            />
          </div>
          <div>
            <label htmlFor="free" className="block text-sm font-medium text-gray-700 mb-1">
              Free license <span className="text-xs text-gray-500 font-normal">(Auto-calculated)</span>
            </label>
            <input
              id="free"
              type="number"
              min="0"
              value={calculatedFree}
              disabled={true}
              readOnly={true}
              className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-100 cursor-not-allowed text-gray-600"
              placeholder="Auto-calculated: Total − Assigned"
            />
            <p className="text-xs text-gray-500 mt-1">
              Formula: Total Teams license ({totalTeams || 0}) − Total assigned license ({totalAssigned || 0}) = {calculatedFree}
            </p>
          </div>
          {canEdit && (
            <div className="flex items-center gap-3 pt-2">
              <button 
                type="button" 
                onClick={handleSubmit} 
                disabled={updateMutation?.isPending}
                className="btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMutation?.isPending ? 'Saving...' : 'Save'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 font-medium">Saved.</span>
              )}
              {updateMutation?.isError && (
                <span className="text-sm text-red-600 font-medium">
                  Error: {updateMutation.error?.response?.data?.detail || 'Failed to save'}
                </span>
              )}
            </div>
          )}
          {!canEdit && (
            <div className="pt-2">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                <p className="text-sm text-yellow-800">
                  <span className="lnr lnr-lock text-yellow-600 mr-2"></span>
                  You don't have permission to edit license values. Contact an administrator to make changes.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
