import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEmployeeFiles, deleteEmployeeFiles } from '../../lib/api'
import { useNavigate } from 'react-router-dom'
import ConfirmDialog from '../../components/ConfirmDialog'

export default function EmployeeBatchesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selected, setSelected] = useState([])
  const [showConfirm, setShowConfirm] = useState(false)

  const { data: files = [], isLoading, error } = useQuery({
    queryKey: ['employee_files'],
    queryFn: listEmployeeFiles,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteEmployeeFiles,
    onSuccess: (data) => {
      console.log('Delete success:', data)
      queryClient.invalidateQueries({ queryKey: ['employee_files'] })
      queryClient.refetchQueries({ queryKey: ['employee_files'] })
      // Hierarchy and scope options come from employee list; clear cache so they update (e.g. empty after delete)
      queryClient.invalidateQueries({ queryKey: ['employeeHierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['scopeOptions'] })
      setSelected([])
      setShowConfirm(false)
      alert(`Successfully deleted ${data.deleted_count} employee file(s)!`)
    },
    onError: (err) => {
      console.error('Delete error:', err)
      alert('Failed to delete files: ' + (err.response?.data?.detail || err.message || 'Unknown error'))
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
    console.log('Delete button clicked, selected:', selected)
    if (selected.length > 0) {
      console.log('Showing confirmation dialog')
      setShowConfirm(true)
    } else {
      console.log('No files selected')
      alert('Please select at least one file to delete')
    }
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
        <h2 className="text-2xl font-bold text-gray-900">Uploaded Employee List Files</h2>
        <p className="text-gray-600 mt-1">Manage your uploaded employee list data batches</p>
      </div>

      {files.length === 0 ? (
        <div className="card p-6 text-center text-gray-600">
          <p>No employee list files uploaded yet. Go to "Upload Employee List" to get started.</p>
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
                  <th className="th px-4 py-3">Total Employees</th>
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
                    <td className="td px-4 py-3">{file.total_rows}</td>
                    <td className="td px-4 py-3">{new Date(file.uploaded_at).toLocaleString()}</td>
                    <td className="td px-4 py-3">
                      <button
                        onClick={() => navigate(`/teams/employee/files/${file.id}`)}
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
        title="Delete Employee Files"
        message={`Are you sure you want to delete ${selected.length} selected file(s)? This action cannot be undone.`}
        onConfirm={() => {
          console.log('Confirm clicked, deleting files:', selected)
          deleteMutation.mutate(selected)
        }}
        onCancel={() => {
          console.log('Cancel clicked')
          setShowConfirm(false)
        }}
      />
    </div>
  )
}

