import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function MultiSelectSearchable({ 
  id, 
  label, 
  value = [], 
  onChange, 
  options, 
  placeholder = 'Select...',
  icon,
  className = '',
  showSelectAll = false
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const searchInputRef = useRef(null)

  // Ensure value is an array
  const selectedValues = Array.isArray(value) ? value : []

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true
    const optionValue = typeof option === 'object' ? option.value : option
    const optionLabel = typeof option === 'object' ? option.label || option.value : option
    return optionLabel.toLowerCase().includes(searchTerm.toLowerCase()) ||
           String(optionValue).toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Map value -> label for display
  const valueToLabel = new Map()
  options.forEach(opt => {
    const v = typeof opt === 'object' ? opt.value : opt
    const l = typeof opt === 'object' ? (opt.label ?? opt.value) : opt
    valueToLabel.set(v, String(l ?? v))
  })

  // Get display value: show all selected names (join with comma; button can wrap to show more)
  const selectedLabels = selectedValues.map(v => valueToLabel.get(v) ?? String(v))
  const displayValue = selectedValues.length === 0 ? placeholder : selectedLabels.join(', ')
  const fullListTitle = selectedLabels.length > 0 ? selectedLabels.join(', ') : undefined

  // Calculate dropdown position
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: rect.width
      })
    }
  }, [isOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        const portalDropdown = document.querySelector(`[data-portal-dropdown="${id}"]`)
        if (portalDropdown && !portalDropdown.contains(event.target)) {
          setIsOpen(false)
          setSearchTerm('')
        } else if (!portalDropdown) {
          setIsOpen(false)
          setSearchTerm('')
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isOpen, id])

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setSearchTerm('')
    }
  }

  const handleOptionClick = (optionValue) => {
    const newValues = selectedValues.includes(optionValue)
      ? selectedValues.filter(v => v !== optionValue)
      : [...selectedValues, optionValue]
    
    onChange(newValues)
  }

  const handleClear = (e) => {
    e.stopPropagation()
    onChange([])
  }

  const allFilteredValues = filteredOptions.map(opt => typeof opt === 'object' ? opt.value : opt)
  const handleSelectAll = (e) => {
    e.stopPropagation()
    onChange([...new Set([...selectedValues, ...allFilteredValues])])
  }
  const handleClearAll = (e) => {
    e.stopPropagation()
    const remaining = selectedValues.filter(v => !allFilteredValues.includes(v))
    onChange(remaining)
  }
  const allFilteredSelected = allFilteredValues.length > 0 && allFilteredValues.every(v => selectedValues.includes(v))

  const hasSelection = selectedValues.length > 0

  return (
    <div className={`relative ${className}`}>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        {icon && <span className={`lnr ${icon} text-blue-600`}></span>}
        {label}
        {hasSelection && (
          <span className="inline-flex items-center justify-center min-w-[1.25rem] px-1.5 py-0.5 text-xs font-bold text-white bg-blue-600 rounded-full" title={`${selectedValues.length} selected`}>
            {selectedValues.length}
          </span>
        )}
      </label>
      <button
        ref={buttonRef}
        type="button"
        id={id}
        onClick={handleToggle}
        className={`w-full px-4 py-2.5 border-2 rounded-md font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm flex items-center justify-between ${
          hasSelection
            ? 'border-blue-500 bg-blue-50 text-gray-900 hover:bg-blue-100'
            : 'border-gray-300 bg-white text-gray-900 hover:border-blue-400'
        }`}
      >
        <span
          className={`block text-left flex-1 min-w-0 line-clamp-2 ${hasSelection ? 'text-gray-900 font-medium' : 'text-gray-500'}`}
          title={fullListTitle}
        >
          {displayValue}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {selectedValues.length > 0 && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClear(e) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClear(e) } }}
              className="text-red-500 hover:text-red-700 transition-colors cursor-pointer"
              title="Clear selection"
            >
              <span className="lnr lnr-cross text-sm"></span>
            </span>
          )}
          <span className={`lnr ${isOpen ? 'lnr-chevron-up' : 'lnr-chevron-down'} text-gray-400`}></span>
        </div>
      </button>

      {isOpen && (typeof document !== 'undefined' && document.body ? createPortal(
        <div
          data-portal-dropdown={id}
          ref={dropdownRef}
          className="absolute bg-white border-2 border-blue-300 rounded-md shadow-xl z-[99999] max-h-80 overflow-hidden flex flex-col"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <span className="lnr lnr-magnifier absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"></span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {showSelectAll && filteredOptions.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex gap-2 bg-gray-50">
                <button
                  type="button"
                  onClick={allFilteredSelected ? handleClearAll : handleSelectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  {allFilteredSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No options found</div>
            ) : (
              <div className="py-1">
                {filteredOptions.map((option, idx) => {
                  const optionValue = typeof option === 'object' ? option.value : option
                  const optionLabel = typeof option === 'object' ? option.label || option.value : option
                  const isSelected = selectedValues.includes(optionValue)
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOptionClick(optionValue)}
                      className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                        isSelected ? 'bg-blue-100' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleOptionClick(optionValue)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}>
                        {optionLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {filteredOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 text-center">
              {filteredOptions.length} option{filteredOptions.length !== 1 ? 's' : ''} • {selectedValues.length} selected
            </div>
          )}
        </div>,
        document.body
      ) : (
        <div
          ref={dropdownRef}
          className="absolute bg-white border-2 border-blue-300 rounded-md shadow-xl z-[99999] max-h-80 overflow-hidden flex flex-col"
          style={{
            top: `${dropdownPosition.top}px`,
            left: `${dropdownPosition.left}px`,
            width: `${dropdownPosition.width}px`,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
            <div className="relative">
              <span className="lnr lnr-magnifier absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400"></span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {showSelectAll && filteredOptions.length > 0 && (
              <div className="px-4 py-2 border-b border-gray-100 flex gap-2 bg-gray-50">
                <button
                  type="button"
                  onClick={allFilteredSelected ? handleClearAll : handleSelectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  {allFilteredSelected ? 'Clear all' : 'Select all'}
                </button>
              </div>
            )}
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">No options found</div>
            ) : (
              <div className="py-1">
                {filteredOptions.map((option, idx) => {
                  const optionValue = typeof option === 'object' ? option.value : option
                  const optionLabel = typeof option === 'object' ? option.label || option.value : option
                  const isSelected = selectedValues.includes(optionValue)
                  
                  return (
                    <div
                      key={idx}
                      onClick={() => handleOptionClick(optionValue)}
                      className={`px-4 py-2 cursor-pointer hover:bg-blue-50 transition-colors flex items-center gap-2 ${
                        isSelected ? 'bg-blue-100' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleOptionClick(optionValue)}
                        className="form-checkbox h-4 w-4 text-blue-600 rounded"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className={isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}>
                        {optionLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {filteredOptions.length > 0 && (
            <div className="p-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 text-center">
              {filteredOptions.length} option{filteredOptions.length !== 1 ? 's' : ''} • {selectedValues.length} selected
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
