import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCtcPerHourByFunction, setCtcPerHourByFunction } from '../lib/api'
import Toast from '../components/Toast'

export default function CostSettingsPage() {
  const queryClient = useQueryClient()
  const [valuesByFunction, setValuesByFunction] = useState({})
  const [toast, setToast] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['ctc-per-hour-by-function'],
    queryFn: getCtcPerHourByFunction,
  })

  useEffect(() => {
    if (data?.ctc_by_function && typeof data.ctc_by_function === 'object') {
      const next = {}
      for (const [fn, val] of Object.entries(data.ctc_by_function)) {
        next[fn] = val != null && val !== '' ? String(val) : ''
      }
      setValuesByFunction(next)
    } else {
      setValuesByFunction({})
    }
  }, [data])

  const functions = Array.isArray(data?.functions) ? data.functions : []

  const saveMutation = useMutation({
    mutationFn: (payload) => setCtcPerHourByFunction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ctc-per-hour-by-function'] })
      queryClient.invalidateQueries({ queryKey: ['ctc-per-hour'] })
      setToast({ type: 'success', message: 'Function-wise CTC per hour saved successfully.' })
    },
    onError: (err) => {
      setToast({ type: 'error', message: err.response?.data?.detail || err.message || 'Failed to save.' })
    },
  })

  const handleChange = (fn, value) => {
    setValuesByFunction((prev) => ({ ...prev, [fn]: value }))
  }

  const handleSave = () => {
    const ctc_by_function = {}
    for (const fn of functions) {
      const raw = valuesByFunction[fn]
      if (raw === '' || raw == null) continue
      const num = Number(raw)
      if (Number.isNaN(num) || num < 0) {
        setToast({ type: 'error', message: `Please enter a valid non-negative number for "${fn}".` })
        return
      }
      ctc_by_function[fn] = num
    }
    saveMutation.mutate(ctc_by_function)
  }

  return (
    <div className="space-y-6">
      <div className="card p-6 max-w-2xl">
        <h1 className="text-xl font-bold text-gray-800 mb-2">Cost Settings</h1>
        <p className="text-sm text-gray-600 mb-6">
          Set the average CTC (Cost to Company) per employee per hour in BDT for each function. These values are used to calculate the cost of lost work hours on the Lost Hours Cost Analysis page. Leave blank to skip that function in cost calculations.
        </p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-gray-600">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
            Loading...
          </div>
        ) : functions.length === 0 ? (
          <p className="text-sm text-amber-700">
            No functions found. Upload an Employee List (with a &quot;Function&quot; column) so functions appear here.
          </p>
        ) : (
          <>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
              {functions.map((fn) => (
                <div key={fn} className="flex flex-wrap items-center gap-3">
                  <label className="w-48 shrink-0 text-sm font-medium text-gray-700">{fn}</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="input border border-gray-300 rounded-lg px-4 py-2 w-36"
                    value={valuesByFunction[fn] ?? ''}
                    onChange={(e) => handleChange(fn, e.target.value)}
                    placeholder="BDT"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saveMutation.isPending ? 'Saving...' : 'Save all'}
              </button>
            </div>
          </>
        )}
      </div>
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}
