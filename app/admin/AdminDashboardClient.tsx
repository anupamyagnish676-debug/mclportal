'use client'
import { useRouter } from 'next/navigation'

export default function AdminDashboardClient({ 
  completedInterns,
  isAdminGlobal,
  selectedArea,
  areas = []
}: { 
  completedInterns: any[] 
  isAdminGlobal: boolean
  selectedArea: string
  areas?: { name: string }[]
}) {
  const router = useRouter()

  function handleExport() {
    if (!completedInterns.length) {
      alert('No completed interns found to export.')
      return
    }

    const headers = 'Serial Number,Name,Email,Roll Number,University,Wing / Department,Start Date,End Date,Area\n'
    const rows = completedInterns.map(i => {
      const s = i.student || {}
      return `"${i.serial_no || ''}","${s.full_name || ''}","${s.email || ''}","${s.roll_no || ''}","${s.university || ''}","${s.wing || ''}","${i.start_date || ''}","${i.end_date || ''}","${s.area || 'General'}"`
    }).join('\n')

    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mcl_completed_interns_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex items-center gap-3">
      {isAdminGlobal && (
        <select
          value={selectedArea}
          onChange={e => {
            const area = e.target.value
            router.push(area ? `/admin?area=${area}` : '/admin')
          }}
          className="border border-gray-250 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white text-gray-700 font-semibold cursor-pointer shadow-sm"
        >
          <option value="">All Offices / Areas</option>
          {areas.map(a => (
            <option key={a.name} value={a.name}>
              {a.name === 'Headquarters' ? 'Headquarters (Central)' : `${a.name} Area`}
            </option>
          ))}
        </select>
      )}
      <button
        onClick={handleExport}
        className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
      >
        📊 Export Completed (CSV)
      </button>
    </div>
  )
}
