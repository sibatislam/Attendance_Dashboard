import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getTeamsCompanyActivity } from '../../../lib/api'
import ActivityBar from '../../../components/ActivityBar'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import TeamsLicenseCards from '../../../components/TeamsLicenseCards'

// Helper function to format month string to "MonthName Year" format
const formatMonthWithYear = (monthStr) => {
  if (!monthStr) return ''
  
  // Handle formats like "2024-08", "2024-8", "08-2024", etc.
  const dateMatch = monthStr.match(/(\d{4})[-/](\d{1,2})/)
  if (dateMatch) {
    const year = dateMatch[1]
    const month = parseInt(dateMatch[2], 10)
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December']
    if (month >= 1 && month <= 12) {
      return `${monthNames[month - 1]} ${year}`
    }
  }
  
  // Handle abbreviated month names like "Aug", "Oct", etc.
  const monthAbbr = {
    'Jan': 'January', 'Feb': 'February', 'Mar': 'March', 'Apr': 'April',
    'May': 'May', 'Jun': 'June', 'Jul': 'July', 'Aug': 'August',
    'Sep': 'September', 'Oct': 'October', 'Nov': 'November', 'Dec': 'December'
  }
  
  // Try to match abbreviated month
  for (const [abbr, full] of Object.entries(monthAbbr)) {
    if (monthStr.toLowerCase().includes(abbr.toLowerCase())) {
      // Try to extract year
      const yearMatch = monthStr.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear()
      return `${full} ${year}`
    }
  }
  
  // If it's already a full month name, try to add year
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                     'July', 'August', 'September', 'October', 'November', 'December']
  for (const monthName of monthNames) {
    if (monthStr.toLowerCase().includes(monthName.toLowerCase())) {
      const yearMatch = monthStr.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : new Date().getFullYear()
      return `${monthName} ${year}`
    }
  }
  
  // Fallback: return as-is if we can't parse it
  return monthStr
}

// Helper function to format month range
const formatMonthRange = (fromMonth, toMonth) => {
  if (!fromMonth && !toMonth) return ''
  const from = formatMonthWithYear(fromMonth)
  const to = formatMonthWithYear(toMonth)
  
  if (from && to) {
    return `${from} to ${to}`
  } else if (from) {
    return from
  } else if (to) {
    return to
  }
  return ''
}

export default function CompanyWiseTab({ files, employeeFiles, selectedFileId, setSelectedFileId, selectedEmployeeFileId, setSelectedEmployeeFileId }) {
  const [groupCompareMode, setGroupCompareMode] = useState(false)
  const [groupCompareFileId, setGroupCompareFileId] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  const chartsRef = useRef(null)

  const { data: companyData = [], isLoading: isLoadingCompany } = useQuery({
    queryKey: ['teams_company_activity', selectedFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsCompanyActivity(selectedFileId, selectedEmployeeFileId),
    enabled: files.length > 0 && employeeFiles.length > 0,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  const { data: companyCompareData = [], isLoading: isLoadingCompanyCompare } = useQuery({
    queryKey: ['teams_company_activity_compare', groupCompareFileId, selectedEmployeeFileId],
    queryFn: () => getTeamsCompanyActivity(groupCompareFileId, selectedEmployeeFileId),
    enabled: groupCompareMode && groupCompareFileId !== null,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchInterval: false,
  })

  // Get file labels for legend
  const fileLabels = {
    file1Label: (() => {
      const file1 = files.find(f => f.id === selectedFileId)
      return file1 ? formatMonthRange(file1.from_month, file1.to_month) || 'File 1' : 'File 1'
    })(),
    file2Label: (() => {
      const file2 = files.find(f => f.id === groupCompareFileId)
      return file2 ? formatMonthRange(file2.from_month, file2.to_month) || 'File 2' : 'File 2'
    })(),
  }

  // Download charts as PNG
  const downloadChartsAsPNG = async () => {
    try {
      const chartsElement = chartsRef.current
      if (!chartsElement) {
        alert('Charts not found')
        return
      }

      setIsExporting(true)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const canvas = await html2canvas(chartsElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 10000,
      })
      
      const imgData = canvas.toDataURL('image/png', 1.0)
      const link = document.createElement('a')
      const fileName = `Company_Activity_Charts_${new Date().toISOString().split('T')[0]}.png`
      link.download = fileName.replace(/[^a-z0-9._-]/gi, '_')
      link.href = imgData
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error('Error downloading charts:', error)
      alert('Error downloading charts: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  // Export to PDF
  const exportToPDF = async () => {
    try {
      setIsExporting(true)
      
      const pdf = new jsPDF('landscape', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      await new Promise(resolve => setTimeout(resolve, 500))
      
      const chartsElement = chartsRef.current
      if (!chartsElement) {
        throw new Error('Charts not found')
      }

      const chartSections = Array.from(chartsElement.querySelectorAll('#activity-charts-container > div'))
      
      if (chartSections.length === 0) {
        chartsElement.scrollIntoView({ behavior: 'instant', block: 'start' })
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const canvas = await html2canvas(chartsElement, {
          scale: 1.2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          imageTimeout: 10000,
        })
        
        const imgData = canvas.toDataURL('image/jpeg', 0.9)
        const imgWidth = canvas.width
        const imgHeight = canvas.height
        const pdfImgWidth = pdfWidth - 20
        const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth
        
        pdf.setFontSize(16)
        pdf.setFont('helvetica', 'bold')
        pdf.setTextColor(40, 40, 40)
        pdf.text('Company-wise Activity', pdfWidth / 2, 15, { align: 'center' })
        
        let yPos = 25
        if (pdfImgHeight > pdfHeight - 30) {
          const scaledHeight = pdfHeight - 30
          const scaledWidth = (imgWidth * scaledHeight) / imgHeight
          pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, yPos, scaledWidth, scaledHeight)
        } else {
          pdf.addImage(imgData, 'JPEG', 10, yPos, pdfImgWidth, pdfImgHeight)
        }
      } else {
        for (let i = 0; i < chartSections.length; i++) {
          const section = chartSections[i]
          const title = section.querySelector('h4')?.textContent?.trim() || `Chart ${i + 1}`
          
          section.scrollIntoView({ behavior: 'instant', block: 'center' })
          await new Promise(resolve => setTimeout(resolve, 300))
          
          const canvas = await html2canvas(section, {
            scale: 1.5,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            imageTimeout: 10000,
          })
          
          const imgData = canvas.toDataURL('image/jpeg', 0.9)
          const imgWidth = canvas.width
          const imgHeight = canvas.height
          
          const pdfImgWidth = pdfWidth - 20
          const pdfImgHeight = (imgHeight * pdfImgWidth) / imgWidth
          
          if (i > 0) pdf.addPage()
          
          pdf.setFontSize(16)
          pdf.setFont('helvetica', 'bold')
          pdf.setTextColor(40, 40, 40)
          pdf.text(title, pdfWidth / 2, 15, { align: 'center' })
          
          let yPos = 25
          if (pdfImgHeight > pdfHeight - 30) {
            const scaledHeight = pdfHeight - 30
            const scaledWidth = (imgWidth * scaledHeight) / imgHeight
            pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, yPos, scaledWidth, scaledHeight)
          } else {
            pdf.addImage(imgData, 'JPEG', 10, yPos, pdfImgWidth, pdfImgHeight)
          }
        }
      }
      
      const fileName = `Company_Activity_Report_${new Date().toISOString().split('T')[0]}.pdf`
      pdf.save(fileName.replace(/[^a-z0-9._-]/gi, '_'))
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Error exporting PDF: ' + error.message)
    } finally {
      setIsExporting(false)
    }
  }

  if (isLoadingCompany || isLoadingCompanyCompare) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading company activity data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isExporting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Exporting...</h3>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-2">
              <div className="bg-blue-600 h-4 rounded-full transition-all duration-300 w-full animate-pulse" />
            </div>
            <p className="text-sm text-gray-600 text-center">Please wait...</p>
          </div>
        </div>
      )}

      {/* License cards */}
      <TeamsLicenseCards />

      {/* Filters */}
      <div className="card p-6 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 shadow-lg space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-blue-200">
          <label className="inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={groupCompareMode}
              onChange={(e) => {
                setGroupCompareMode(e.target.checked)
                if (!e.target.checked) setGroupCompareFileId(null)
              }}
              className="h-5 w-5 text-blue-600 rounded border-2 border-gray-300 focus:ring-2 focus:ring-blue-500"
            />
            <span className="ml-2 text-base font-semibold text-gray-800">Enable Comparison Mode</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="teamsFileSelect3" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-file-empty text-blue-600"></span>
              {groupCompareMode ? 'Teams File 1' : 'Teams Activity File'}
            </label>
            <select
              id="teamsFileSelect3"
              value={selectedFileId || ''}
              onChange={(e) => setSelectedFileId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400"
            >
              <option value="">Select Teams file</option>
              {files.map(f => (
                <option key={f.id} value={f.id}>
                  {formatMonthRange(f.from_month, f.to_month) || f.filename}
                </option>
              ))}
            </select>
          </div>

          {groupCompareMode && (
            <div className="bg-white rounded-lg p-3 border-2 border-blue-400 shadow-sm">
              <label htmlFor="companyCompareFileSelect" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                <span className="lnr lnr-file-empty text-blue-600"></span>
                Teams File 2
              </label>
              <select
                id="companyCompareFileSelect"
                value={groupCompareFileId || ''}
                onChange={(e) => setGroupCompareFileId(e.target.value ? parseInt(e.target.value) : null)}
                className="w-full px-4 py-2.5 border-2 border-blue-400 rounded-md bg-white text-gray-900 font-medium focus:border-blue-600 focus:ring-2 focus:ring-blue-300 transition-all shadow-sm hover:border-blue-500"
              >
                <option value="">Select file to compare</option>
                {files.filter(f => f.id !== selectedFileId).map(f => (
                  <option key={f.id} value={f.id}>
                    {formatMonthRange(f.from_month, f.to_month) || f.filename}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-white rounded-lg p-3 border-2 border-blue-300 shadow-sm">
            <label htmlFor="employeeFileSelect2" className="block text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <span className="lnr lnr-users text-blue-600"></span>
              Employee List File
            </label>
            <select
              id="employeeFileSelect2"
              value={selectedEmployeeFileId || ''}
              onChange={(e) => setSelectedEmployeeFileId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-md bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all shadow-sm hover:border-blue-400"
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

      {/* Export Actions */}
      {companyData.length > 0 && (
        <div className="card p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-gray-800">Export Options</h4>
              <p className="text-xs text-gray-600 mt-1">Download charts and reports</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={downloadChartsAsPNG}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                title="Download all charts as PNG"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download PNG
              </button>
              <button
                onClick={exportToPDF}
                disabled={isExporting}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2 shadow-sm"
                title="Export all charts to PDF"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {companyData.length > 0 && (
        <div ref={chartsRef} className="card p-6">
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

      {companyData.length === 0 && !isLoadingCompany && (
        <div className="card p-6 text-center text-gray-600">
          <p>No company data available. Please select both Teams activity file and Employee list file.</p>
        </div>
      )}
    </div>
  )
}
