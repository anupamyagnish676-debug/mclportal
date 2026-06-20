'use client'

export default function AdminDashboardClient({ completedInterns }: { completedInterns: any[] }) {
  function handleExport() {
    if (!completedInterns.length) {
      alert('No completed interns found to export.')
      return
    }

    const headers = 'Serial Number,Name,Email,Roll Number,University,Wing / Department,Start Date,End Date\n'
    const rows = completedInterns.map(i => {
      const s = i.student || {}
      return `"${i.serial_no || ''}","${s.full_name || ''}","${s.email || ''}","${s.roll_no || ''}","${s.university || ''}","${s.wing || ''}","${i.start_date || ''}","${i.end_date || ''}"`
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
    <button
      onClick={handleExport}
      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5"
    >
      📊 Export Completed Interns (CSV)
    </button>
  )
}
