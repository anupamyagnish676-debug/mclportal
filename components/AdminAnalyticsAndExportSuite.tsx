'use client'
import { useState } from 'react'

export default function AdminAnalyticsAndExportSuite({
  internships,
  areas
}: {
  internships: any[]
  areas: any[]
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [selectedExportArea, setSelectedExportArea] = useState<string>('all')

  async function handleDownload(format: 'xlsx' | 'pdf') {
    try {
      setDownloading(format)
      const res = await fetch(`/api/admin/export-data?format=${format}&area=${encodeURIComponent(selectedExportArea)}`)
      if (!res.ok) {
        const errData = await res.json()
        alert(errData.error || 'Failed to download file')
        return
      }

      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const fileName = format === 'xlsx' ? `MCL_Master_Interns_Register_${Date.now()}.xlsx` : `MCL_Master_Interns_Report_${Date.now()}.pdf`

      const link = document.createElement('a')
      link.href = blobUrl
      link.download = fileName
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (e: any) {
      console.error('Download error:', e)
      alert('Download error: ' + (e.message || 'Server connection issue'))
    } finally {
      setDownloading(null)
    }
  }

  // Calculate Area-wise breakdown metrics
  const areaStatsMap: Record<string, { total: number; active: number; completed: number; paid: number; unpaid: number }> = {}

  areas.forEach(a => {
    areaStatsMap[a.name] = { total: 0, active: 0, completed: 0, paid: 0, unpaid: 0 }
  })
  // Fallback HQ
  if (!areaStatsMap['Headquarters']) {
    areaStatsMap['Headquarters'] = { total: 0, active: 0, completed: 0, paid: 0, unpaid: 0 }
  }

  internships.forEach(item => {
    const areaName = item.area?.name || 'Headquarters'
    if (!areaStatsMap[areaName]) {
      areaStatsMap[areaName] = { total: 0, active: 0, completed: 0, paid: 0, unpaid: 0 }
    }
    const stat = areaStatsMap[areaName]
    stat.total += 1
    if (item.is_active) stat.active += 1
    else stat.completed += 1

    if (item.is_paid) stat.paid += 1
    else stat.unpaid += 1
  })

  const areaEntries = Object.entries(areaStatsMap)
  const totalAllInterns = internships.length
  const totalActive = internships.filter(i => i.is_active).length
  const totalCompleted = totalAllInterns - totalActive
  const overallCompletionRate = totalAllInterns > 0 ? Math.round((totalCompleted / totalAllInterns) * 100) : 100

  return (
    <div className="my-6">
      {/* One-Click Excel & PDF Export Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-bold text-white">Master Export Suite</h2>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Download formatted Master Registries in Excel (`.xlsx`) or PDF format directly to your device.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedExportArea}
            onChange={e => setSelectedExportArea(e.target.value)}
            className="bg-slate-800/80 border border-slate-700 text-white text-xs font-bold rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">🌐 All Areas Combined</option>
            {areas.map(a => (
              <option key={a.name} value={a.name}>
                {a.name === 'Headquarters' ? 'Headquarters (Central)' : `${a.name} Area`}
              </option>
            ))}
          </select>

          <button
            onClick={() => handleDownload('xlsx')}
            disabled={Boolean(downloading)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <span>📥 Export Excel (.xlsx)</span>
            {downloading === 'xlsx' && <span className="animate-spin text-xs">🌀</span>}
          </button>

          <button
            onClick={() => handleDownload('pdf')}
            disabled={Boolean(downloading)}
            className="bg-red-600 hover:bg-red-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
          >
            <span>📄 Export PDF Report</span>
            {downloading === 'pdf' && <span className="animate-spin text-xs">🌀</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
