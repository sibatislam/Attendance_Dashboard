import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listTeamsAppFiles, deleteTeamsAppFiles } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function TeamsAppBatchesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ['teams_app_files'],
    queryFn: listTeamsAppFiles,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTeamsAppFiles,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['teams_app_files'] })
      setSelected([])
      setShowConfirm(false)
      if (data?.deleted_count > 0) {
        alert(`Successfully deleted ${data.deleted_count} file(s)`)
      } else {
        alert('No files were deleted. Please check if the files exist.')
      }
    },
    onError: (err) => {
      console.error('Delete error:', err)
      const errorMessage = err.response?.data?.detail || err.message || 'Unknown error occurred'
      alert('Failed to delete files: ' + errorMessage)
      setShowConfirm(false)
    },
  })

  const toggleSelect = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selected.length === files.length) {
      setSelected([])
    } else {
      setSelected(files.map((file) => file.id))
    }
  }

  const handleDeleteSelected = () => {
    if (selected.length > 0) {
      setShowConfirm(true)
    } else {
      alert('Please select at least one file to delete')
    }
  }

  const handleConfirmDelete = () => {
    if (selected.length === 0) {
      alert('No files selected')
      setShowConfirm(false)
      return
    }
    // Ensure IDs are numbers
    const idsToDelete = selected.map(id => Number(id)).filter(id => !isNaN(id))
    if (idsToDelete.length === 0) {
      alert('Invalid file IDs')
      setShowConfirm(false)
      return
    }
    deleteMutation.mutate(idsToDelete)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading files...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 text-center p-4">
        Error loading files: {error.message}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Uploaded Teams App Usage Files</h2>
        <p className="text-gray-600 mt-1">Manage your uploaded Teams app usage data</p>
      </div>

      {files.length === 0 ? (
        <div className="card p-6 text-center text-gray-600">
          <p>No Teams app files uploaded yet. Go to "Upload App Usage" to get started.</p>
        </div>
      ) : (
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="text-sm text-gray-700">
              {selected.length} of {files.length} selected
            </div>
            {selected.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="btn-danger flex items-center gap-2"
                disabled={deleteMutation.isPending}
              >
                <span className="lnr lnr-trash"></span>
                Delete Selected
              </button>
            )}
          </div>

          <div className="overflow-x-auto max-h-[600px]">
            <table className="table">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr className="bg-gray-50">
                  <th className="th px-4 py-3 w-12">
                    <input
                      type="checkbox"
                      checked={selected.length === files.length && files.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4"
                    />
                  </th>
                  <th className="th px-4 py-3">Filename</th>
                  <th className="th px-4 py-3">From Month</th>
                  <th className="th px-4 py-3">To Month</th>
                  <th className="th px-4 py-3">Total Rows</th>
                  <th className="th px-4 py-3">Uploaded At</th>
                  <th className="th px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {files.map((file) => (
                  <tr key={file.id} className="hover:bg-gray-50">
                    <td className="td px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.includes(file.id)}
                        onChange={() => toggleSelect(file.id)}
                        className="h-4 w-4"
                      />
                    </td>
                    <td className="td px-4 py-3 font-medium">{file.filename}</td>
                    <td className="td px-4 py-3">{file.from_month || '-'}</td>
                    <td className="td px-4 py-3">{file.to_month || '-'}</td>
                    <td className="td px-4 py-3">{file.total_rows}</td>
                    <td className="td px-4 py-3">{new Date(file.uploaded_at).toLocaleString()}</td>
                    <td className="td px-4 py-3">
                      <button
                        onClick={() => navigate(`/teams/app/files/${file.id}`)}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showConfirm}
        title="Delete Files"
        message={`Are you sure you want to delete ${selected.length} selected file(s)? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  )
}

