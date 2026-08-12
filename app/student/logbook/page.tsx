'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function StudentLogbookPage() {
  const supabase = createClient()
  const [internship, setInternship] = useState<any>(null)
  const [logbooks, setLogbooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [content, setContent] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }

      // Fetch internship
      const { data: intern, error: intErr } = await supabase
        .from('internships')
        .select('id, start_date, end_date, serial_no, area, student:profiles!internships_student_id_fkey(full_name, email, university, roll_no, wing)')
        .eq('student_id', user.id)
        .maybeSingle()

      if (intErr) {
        setError(intErr.message)
        setLoading(false)
        return
      }

      if (intern) {
        setInternship({
          ...intern,
          student: Array.isArray(intern.student) ? intern.student[0] : intern.student
        })
        // Fetch logbooks
        const { data: logs, error: logsErr } = await supabase
          .from('logbooks')
          .select('*')
          .eq('internship_id', intern.id)
          .order('date', { ascending: false })

        if (logsErr) {
          setError(logsErr.message)
        } else {
          setLogbooks(logs || [])
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  function handleDownloadWord() {
    if (!logbooks.length) return
    const studentName = internship?.student?.full_name || 'Student'
    const serialNo = internship?.serial_no ? `MCL/HRD/INT/${internship.serial_no}` : 'N/A'
    const area = internship?.area || 'Headquarters'

    let html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head><title>Daily Logbook Report - MCL</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 30px; }
        h1 { color: #166534; font-size: 22px; text-align: center; margin-bottom: 5px; }
        h2 { color: #374151; font-size: 14px; text-align: center; font-weight: normal; margin-top: 0; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        .meta-table td { padding: 8px; border: 1px solid #e5e7eb; font-size: 12px; }
        .meta-label { font-weight: bold; background-color: #f9fafb; width: 25%; }
        .log-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .log-table th { background-color: #166534; color: white; padding: 10px; font-size: 12px; text-align: left; }
        .log-table td { padding: 10px; border: 1px solid #d1d5db; font-size: 12px; vertical-align: top; }
        .date-col { width: 20%; font-weight: bold; color: #166534; }
      </style>
      </head>
      <body>
        <h1>MAHANADI COALFIELDS LIMITED</h1>
        <h2>INTERNSHIP DAILY LOGBOOK REPORT</h2>
        <br/>
        <table class="meta-table">
          <tr><td class="meta-label">Student Name:</td><td>${studentName}</td><td class="meta-label">Serial Number:</td><td>${serialNo}</td></tr>
          <tr><td class="meta-label">Training Office:</td><td>${area} Area</td><td class="meta-label">University / College:</td><td>${internship?.student?.university || 'N/A'}</td></tr>
          <tr><td class="meta-label">Internship Period:</td><td>${internship?.start_date} to ${internship?.end_date}</td><td class="meta-label">Total Logs Recorded:</td><td>${logbooks.length} entries</td></tr>
        </table>
        <br/>
        <table class="log-table">
          <thead>
            <tr>
              <th style="width: 20%;">Date</th>
              <th style="width: 80%;">Work Description & Learnings</th>
            </tr>
          </thead>
          <tbody>
    `

    logbooks.forEach(log => {
      const d = new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })
      const safeContent = (log.content || '').replace(/\n/g, '<br/>')
      html += `
        <tr>
          <td class="date-col">${d}</td>
          <td>${safeContent}</td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
      </body>
      </html>
    `

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `MCL_Logbook_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}.doc`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleDownloadPDF() {
    if (!logbooks.length) return
    const studentName = internship?.student?.full_name || 'Student'
    const serialNo = internship?.serial_no ? `MCL/HRD/INT/${internship.serial_no}` : 'N/A'
    const area = internship?.area || 'Headquarters'

    const win = window.open('', '_blank')
    if (!win) return

    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>MCL Daily Logbook - ${studentName}</title>
        <style>
          @page { size: A4; margin: 20mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; color: #111827; margin: 0; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #166534; padding-bottom: 15px; margin-bottom: 20px; }
          .title { font-size: 20px; font-weight: 800; color: #166534; margin: 0; text-transform: uppercase; }
          .subtitle { font-size: 13px; color: #4b5563; margin-top: 4px; font-weight: 600; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 20px; font-size: 12px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { text-transform: uppercase; font-size: 10px; color: #6b7280; font-weight: 700; }
          .meta-val { font-weight: 700; color: #111827; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #166534; color: white; text-align: left; padding: 8px 12px; font-size: 12px; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 12px; vertical-align: top; }
          tr:nth-child(even) { background: #f9fafb; }
          .date { font-weight: 700; color: #166534; white-space: nowrap; }
          .footer { margin-top: 30px; text-align: right; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">Mahanadi Coalfields Limited</div>
          <div class="subtitle">Official Internship Daily Logbook Report</div>
        </div>
        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Intern Name</span><span class="meta-val">${studentName}</span></div>
          <div class="meta-item"><span class="meta-label">Serial Number</span><span class="meta-val">${serialNo}</span></div>
          <div class="meta-item"><span class="meta-label">Training Office</span><span class="meta-val">${area} Area</span></div>
          <div class="meta-item"><span class="meta-label">College / University</span><span class="meta-val">${internship?.student?.university || 'N/A'}</span></div>
          <div class="meta-item"><span class="meta-label">Internship Period</span><span class="meta-val">${internship?.start_date} to ${internship?.end_date}</span></div>
          <div class="meta-item"><span class="meta-label">Total Log Entries</span><span class="meta-val">${logbooks.length} Days</span></div>
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">Date</th>
              <th style="width: 75%;">Work Done & Learnings</th>
            </tr>
          </thead>
          <tbody>
    `

    logbooks.forEach(log => {
      const d = new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })
      const safeContent = (log.content || '').replace(/\n/g, '<br/>')
      html += `
        <tr>
          <td class="date">${d}</td>
          <td>${safeContent}</td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>
        <div class="footer">Generated on ${new Date().toLocaleDateString('en-IN')} via MCL Portal</div>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `

    win.document.write(html)
    win.document.close()
  }

  async function handleSaveLog(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    // Validate that the selected date is within internship range
    if (internship) {
      const dateVal = new Date(selectedDate)
      const start = new Date(internship.start_date)
      const end = new Date(internship.end_date)
      if (dateVal < start || dateVal > end) {
        setError(`Selected date must be within your internship period (${internship.start_date} to ${internship.end_date}).`)
        setSaving(false)
        return
      }
    }

    const { error: upsertErr } = await supabase
      .from('logbooks')
      .upsert({
        internship_id: internship.id,
        date: selectedDate,
        content: content.trim()
      }, { onConflict: 'internship_id,date' })

    if (upsertErr) {
      setError(upsertErr.message)
    } else {
      setSuccess('Daily logbook entry saved successfully!')
      setContent('')
      // Refresh list
      const { data: logs } = await supabase
        .from('logbooks')
        .select('*')
        .eq('internship_id', internship.id)
        .order('date', { ascending: false })
      setLogbooks(logs || [])
    }
    setSaving(false)
  }

  if (loading) {
    return <div className="text-gray-500 text-sm">Loading logbook data...</div>
  }

  if (!internship) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-gray-400">
        No active internship record found. Please contact the administrator.
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Daily Logbook</h1>
      <p className="text-gray-500 text-sm mb-6">Maintain your daily learning diary. Your assigned mentor reviews these logs periodically.</p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
          {success}
        </div>
      )}

      <div className="grid md:grid-cols-5 gap-6">
        {/* Logbook Editor */}
        <div className="md:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Write Daily Log</h2>
            <form onSubmit={handleSaveLog} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  min={internship.start_date}
                  max={internship.end_date}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Work Description & Learnings</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="What tasks did you work on today? What did you learn?"
                  rows={6}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving log...' : 'Save Log Entry'}
              </button>
            </form>
          </div>

          <div className="bg-green-50/50 border border-green-100 rounded-xl p-4">
            <p className="text-xs text-green-800 leading-relaxed font-medium">
              💡 <strong>Note:</strong> Logs are indexed per day. Writing a log for an existing date will overwrite/update the entry for that day.
            </p>
          </div>
        </div>

        {/* Previous Log Entries */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-50">
              <div>
                <h2 className="font-semibold text-gray-800">Logbook Timeline</h2>
                <span className="text-[11px] text-gray-400 font-normal">{logbooks.length} entries recorded</span>
              </div>
              {logbooks.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadPDF}
                    className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-bold transition-colors border border-red-200 flex items-center gap-1.5 shadow-sm"
                  >
                    <span>📄</span> Export PDF
                  </button>
                  <button
                    onClick={handleDownloadWord}
                    className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-bold transition-colors border border-blue-200 flex items-center gap-1.5 shadow-sm"
                  >
                    <span>📝</span> Export Word
                  </button>
                </div>
              )}
            </div>
            
            {!logbooks.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No daily logs recorded yet. Use the editor to submit your first entry!
              </div>
            ) : (
              <div className="relative border-l border-gray-100 pl-4 ml-2 space-y-6">
                {logbooks.map(log => (
                  <div key={log.id} className="relative">
                    {/* Circle marker */}
                    <div className="absolute -left-[21px] mt-1.5 w-3 h-3 rounded-full bg-green-600 border-2 border-white ring-4 ring-green-50" />
                    
                    <div>
                      <span className="text-xs font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        {new Date(log.date).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          weekday: 'short'
                        })}
                      </span>
                      <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                        {log.content}
                      </p>
                      <span className="block text-[10px] text-gray-400 mt-1">
                        Logged on {new Date(log.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
