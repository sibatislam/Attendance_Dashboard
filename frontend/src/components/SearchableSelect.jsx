import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function SearchableSelect({ 
  id, 
  label, 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...',
  icon,
  className = ''
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const dropdownRef = useRef(null)
  const buttonRef = useRef(null)
  const searchInputRef = useRef(null)

  // Filter options based on search term
  const filteredOptions = options.filter(option => {
    if (!searchTerm) return true // Show all options when search is empty
    const optionText = typeof option === 'string' ? option : option.label || option.value || ''
    return optionText.toLowerCase().includes(searchTerm.toLowerCase())
  })

  // Get display value
  const displayValue = value 
    ? (typeof options[0] === 'object' && options.length > 0
        ? options.find(opt => opt.value === value)?.label || value
        : value)
    : placeholder

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        // Also check if click is on the portal dropdown
        const portalDropdown = document.querySelector('[data-portal-dropdown]')
        if (portalDropdown && !portalDropdown.contains(event.target)) {
          setIsOpen(false)
          setSearchTerm('')
        } else if (!portalDropdown) {
          setIsOpen(false)
          setSearchTerm('')
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Calculate dropdown position when it opens
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

  const handleSelect = (optionValue) => {
    onChange(optionValue)
    setIsOpen(false)
    setSearchTerm('')
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    if (!isOpen) {
      setSearchTerm('')
    }
  }

  const dropdownContent = (
    <div 
      data-portal-dropdown
      className="bg-white border-2 border-blue-300 rounded-md shadow-xl"
      style={{ 
        maxHeight: '320px',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Search input */}
      <div className="p-3 border-b-2 border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Type to search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setIsOpen(false)
                setSearchTerm('')
              }
            }}
          />
        </div>
      </div>

      {/* Options list - always visible */}
      <div className="overflow-y-auto flex-1" style={{ maxHeight: '256px' }}>
        {/* "All" option */}
        <button
          type="button"
          onClick={() => handleSelect('')}
          className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors border-b border-gray-100 ${
            value === '' ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'
          }`}
        >
          <span className="flex items-center gap-2">
            <span className="text-sm font-medium">{placeholder}</span>
          </span>
        </button>

        {/* Filtered options */}
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const optionValue = typeof option === 'string' ? option : option.value
            const optionLabel = typeof option === 'string' ? option : option.label || option.value
            
            return (
              <button
                key={optionValue || `option-${index}`}
                type="button"
                onClick={() => handleSelect(optionValue)}
                className={`w-full px-4 py-2.5 text-left hover:bg-blue-50 transition-colors ${
                  index < filteredOptions.length - 1 ? 'border-b border-gray-100' : ''
                } ${
                  value === optionValue ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700'
                }`}
              >
                <span className="text-sm">{optionLabel}</span>
              </button>
            )
          })
        ) : (
          <div className="px-4 py-6 text-center text-gray-500 text-sm">
            <svg
              className="mx-auto h-8 w-8 text-gray-400 mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>No results found</p>
            <p className="text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Footer with count */}
      {filteredOptions.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 text-center flex-shrink-0">
          {filteredOptions.length} {filteredOptions.length === 1 ? 'option' : 'options'} found
          {searchTerm && ` for "${searchTerm}"`}
        </div>
      )}
    </div>
  )

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <label htmlFor={id} className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
        {icon && <span className={icon}></span>}
        {label}
      </label>
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={handleToggle}
          className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400 text-left flex items-center justify-between"
        >
          <span className={value ? 'text-gray-900' : 'text-gray-500'}>{displayValue}</span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          typeof document !== 'undefined' && document.body ? (
            createPortal(
              <div
                style={{
                  position: 'fixed',
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                  zIndex: 99999
                }}
              >
                {dropdownContent}
              </div>,
              document.body
            )
          ) : (
            <div className="absolute z-[9999] w-full mt-1">
              {dropdownContent}
            </div>
          )
        )}
      </div>
    </div>
  )
}
