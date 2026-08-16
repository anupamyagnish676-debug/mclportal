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
      const url = `/api/admin/export-data?format=${format}&area=${encodeURIComponent(selectedExportArea)}`
      
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', '')
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (e) {
      console.error('Download error:', e)
    } finally {
      setTimeout(() => setDownloading(null), 1500)
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
    <div className="space-y-6 my-8">

      {/* Bar 1: One-Click Excel & PDF Export Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-6 shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h2 className="text-lg font-bold text-white">Master Analytics & One-Click Export Suite</h2>
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

      {/* Bar 2: Area-Wise Analytics Interactive Cards */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <span>📈 Area-Wise Intern Distribution & Completion Metrics</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time analytics across all 5 MCL coalfields and Central Headquarters.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl text-xs font-bold">
            <span>Overall Completion Rate: {overallCompletionRate}%</span>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {areaEntries.map(([name, stat]) => {
            const label = name === 'Headquarters' ? 'Headquarters (Central)' : `${name} Area`
            const compRate = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 100

            return (
              <div key={name} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3 hover:shadow-xs transition-shadow">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs">{label}</h4>
                  <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
                    {stat.total} Interns
                  </span>
                </div>

                {/* Progress bar for Active vs Completed */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                    <span>Active: {stat.active}</span>
                    <span>Completed: {stat.completed}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden flex">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-500"
                      style={{ width: `${stat.total > 0 ? (stat.active / stat.total) * 100 : 0}%` }}
                      title={`Active: ${stat.active}`}
                    />
                    <div
                      className="bg-teal-700 h-full transition-all duration-500"
                      style={{ width: `${stat.total > 0 ? (stat.completed / stat.total) * 100 : 100}%` }}
                      title={`Completed: ${stat.completed}`}
                    />
                  </div>
                </div>

                {/* Paid vs Unpaid ratio tag */}
                <div className="flex justify-between items-center text-[10px] text-slate-500 pt-1 border-t border-slate-150">
                  <span>Paid: <strong className="text-slate-800">{stat.paid}</strong> | Unpaid: <strong className="text-slate-800">{stat.unpaid}</strong></span>
                  <span className="font-bold text-teal-700">{compRate}% Done</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
