import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { uploadEmployeeFiles } from '../../lib/api'

export default function EmployeeUploadPage() {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: uploadEmployeeFiles,
    onSuccess: (data) => {
      alert(`Successfully uploaded ${data.length} employee file(s)!`)
      setFiles([])
      queryClient.invalidateQueries({ queryKey: ['employee_files'] })
      queryClient.invalidateQueries({ queryKey: ['employeeHierarchy'] })
      queryClient.invalidateQueries({ queryKey: ['scopeOptions'] })
    },
    onError: (error) => {
      alert('Upload failed: ' + (error.response?.data?.detail || error.message))
    }
  })

  const handleFiles = (fileList) => {
    const excelFiles = Array.from(fileList).filter(f => 
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv')
    )
    setFiles((prev) => [...prev, ...excelFiles])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleUpload = () => {
    if (files.length === 0) {
      alert('Please select at least one file')
      return
    }
    mutation.mutate(files)
  }

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Upload Employee List Files</h2>
        <p className="text-gray-600 mt-1">Upload Excel or CSV files containing employee information</p>
      </div>

      <div className="card p-8">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="text-gray-600 mb-4">
            <span className="lnr lnr-cloud-upload text-5xl text-gray-400"></span>
          </div>
          <p className="text-lg font-medium text-gray-700 mb-2">
            Drag and drop employee list files here
          </p>
          <p className="text-sm text-gray-500 mb-4">or</p>
          <input
            type="file"
            multiple
            accept=".xlsx,.xls,.csv"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="btn-primary inline-flex items-center px-4 py-2 rounded-md cursor-pointer"
          >
            <span className="lnr lnr-file-add"></span>
            <span className="ml-2">Browse Files</span>
          </label>
          <p className="text-xs text-gray-400 mt-3">Supported formats: .xlsx, .xls, .csv</p>
        </div>

        {files.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Selected Files ({files.length})</h3>
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li
                  key={index}
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-md border border-gray-200"
                >
                  <div className="flex items-center">
                    <span className="lnr lnr-file-empty text-blue-500 mr-3"></span>
                    <div>
                      <p className="text-sm font-medium text-gray-700">{file.name}</p>
                      <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700 transition-colors"
                  >
                    <span className="lnr lnr-trash"></span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setFiles([])}
                className="btn-outline"
                disabled={mutation.isPending}
              >
                Clear All
              </button>
              <button
                onClick={handleUpload}
                className="btn-primary"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? 'Uploading...' : 'Upload Files'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

