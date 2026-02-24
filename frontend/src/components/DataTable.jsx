import { useState, useMemo, useRef, useEffect } from 'react'

// Default: treat row as subtotal if first column value is Total / Subtotal / Total Activities
function defaultIsSubtotalRow(row, firstKey) {
  if (!firstKey) return false
  const v = String(row[firstKey] ?? '').trim().toLowerCase()
  return v === 'total' || v === 'subtotal' || v === 'total activities'
}

export default function DataTable({ columns, headers, rows, isSubtotalRow: isSubtotalRowProp }) {
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc') // 'asc' or 'desc'
  
  // Support both 'columns' and 'headers' props for backwards compatibility
  const cols = columns || headers || []
  const normalized = cols.map(c => typeof c === 'string' ? { key: c, label: c, sortable: false } : c)
  const firstColKey = normalized[0]?.key
  
  // Subtotal row: optional (row) => boolean; default infers from first column
  const isSubtotalRow = useMemo(() => {
    if (typeof isSubtotalRowProp === 'function') return isSubtotalRowProp
    return (row) => defaultIsSubtotalRow(row, firstColKey)
  }, [isSubtotalRowProp, firstColKey])
  
  // Add safety check for rows
  const safeRows = rows || []
  
  // Handle column header click for sorting
  const handleSort = (column) => {
    if (!column.sortable) return
    
    if (sortColumn === column.key) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new column and default to ascending
      setSortColumn(column.key)
      setSortDirection('asc')
    }
  }
  
  // Drag-to-scroll: hold and drag to scroll left/right (starts after ~5px so clicks/selection still work)
  const scrollRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const dragStart = useRef({ clientX: 0, scrollLeft: 0 })
  const dragCommitted = useRef(false)
  const DRAG_THRESHOLD_PX = 5

  useEffect(() => {
    const el = scrollRef.current
    if (!el || !isPointerDown) return

    const onMouseMove = (e) => {
      const start = dragStart.current
      const dx = start.clientX - e.clientX
      if (!dragCommitted.current) {
        if (Math.abs(dx) >= DRAG_THRESHOLD_PX) {
          dragCommitted.current = true
          setIsDragging(true)
        } else return
      }
      el.scrollLeft = start.scrollLeft + (start.clientX - e.clientX)
    }

    const onMouseUp = () => {
      setIsPointerDown(false)
      setIsDragging(false)
      dragCommitted.current = false
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [isPointerDown])

  const handleScrollMouseDown = (e) => {
    if (e.button !== 0) return
    const el = scrollRef.current
    if (!el) return
    dragStart.current = { clientX: e.clientX, scrollLeft: el.scrollLeft }
    dragCommitted.current = false
    setIsPointerDown(true)
  }

  // Sort rows based on current sort column and direction
  const sortedRows = useMemo(() => {
    if (!sortColumn) return safeRows
    
    const column = normalized.find(c => c.key === sortColumn)
    if (!column || !column.sortable) return safeRows
    
    const sortKey = column.sortKey || column.key
    
    return [...safeRows].sort((a, b) => {
      let aVal = a[sortKey] ?? a[column.key] ?? ''
      let bVal = b[sortKey] ?? b[column.key] ?? ''
      
      // Handle numeric values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      }
      
      // Handle string values
      aVal = String(aVal).toLowerCase()
      bVal = String(bVal).toLowerCase()
      
      if (sortDirection === 'asc') {
        return aVal.localeCompare(bVal)
      } else {
        return bVal.localeCompare(aVal)
      }
    })
  }, [safeRows, sortColumn, sortDirection, normalized])
  
  return (
    <div
      ref={scrollRef}
      role="region"
      aria-label="Table - drag to scroll horizontally"
      className="overflow-auto border rounded-md max-w-full max-h-[600px]"
      style={{
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: isDragging ? 'none' : undefined,
      }}
      onMouseDown={handleScrollMouseDown}
      onMouseLeave={() => {
        if (isPointerDown || isDragging) {
          setIsPointerDown(false)
          setIsDragging(false)
          dragCommitted.current = false
        }
      }}
    >
      <table className="table w-full" style={{ tableLayout: 'auto' }}>
        <thead className="bg-gray-100 sticky top-0 z-10">
          <tr>
            {normalized.map((c, idx) => (
              <th
                key={idx}
                className={`th px-3 py-2 bg-gray-100 !text-center ${c.sortable ? 'cursor-pointer hover:bg-gray-200 select-none' : ''} ${c.wrapText ? 'td-wrap-cell' : ''} ${c.compact ? 'th-compact' : ''}`}
                style={c.fillRemaining ? { width: '1%', minWidth: '120px' } : undefined}
                title={c.title || undefined}
                onClick={() => handleSort(c)}
              >
                {c.wrapText ? (
                  <>
                    <span className="td-wrap-inner">{c.label}</span>
                    {c.sortable && sortColumn === c.key && (
                      <span className="text-gray-600 text-xs">
                        {' '}{sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </>
                ) : (
                  <div className="flex gap-2 justify-center">
                    <span>{c.label}</span>
                    {c.sortable && sortColumn === c.key && (
                      <span className="text-gray-600">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sortedRows.map((r, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              {normalized.map((c, cidx) => (
                <td
                  key={cidx}
                  className={`px-3 py-2 text-sm text-gray-900 !text-center ${c.wrapText ? 'align-top td-wrap-cell' : c.compact ? 'td-compact' : 'td'}`}
                  style={c.fillRemaining ? { width: '1%', minWidth: '120px' } : undefined}
                >
                  {typeof c.render === 'function'
                    ? c.render(r)
                    : (() => {
                        const val = r[c.key]
                        const isSubtotal = isSubtotalRow(r)
                        const num = Number(val)
                        const isNumeric = typeof val === 'number' || (typeof val === 'string' && val !== '' && !Number.isNaN(num) && Number.isFinite(num))
                        const display = (isSubtotal && isNumeric)
                          ? (typeof val === 'number' ? val : num).toLocaleString()
                          : (val != null && val !== '' ? String(val) : '')
                        return c.wrapText
                          ? <span className="td-wrap-inner">{display}</span>
                          : display
                      })()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}


