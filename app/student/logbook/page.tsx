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
  const [selectedTag, setSelectedTag] = useState<string>('💻 Task / Work')
  const [searchQuery, setSearchQuery] = useState<string>('')

  const categoryTags = [
    '💻 Task / Work',
    '📚 Research',
    '🔍 Field Visit',
    '🤝 Meeting',
    '📊 Data Analysis',
    '✨ Learnings'
  ]

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
      <head>
        <title>MCL Internship Daily Logbook Report</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; color: #111827; }
          .header-box { text-align: center; border-bottom: 3px double #065f46; padding-bottom: 12px; margin-bottom: 25px; }
          .org-title { color: #065f46; font-size: 24px; font-weight: bold; margin: 0; text-transform: uppercase; letter-spacing: 1px; }
          .org-sub { color: #4b5563; font-size: 13px; margin-top: 4px; font-weight: 600; text-transform: uppercase; }
          .doc-title { color: #1f2937; font-size: 16px; margin-top: 10px; font-weight: bold; background: #ecfdf5; padding: 6px; border: 1px solid #a7f3d0; text-align: center; }
          
          .meta-table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 25px; }
          .meta-table td { padding: 8px 12px; border: 1px solid #d1d5db; font-size: 11px; }
          .meta-label { font-weight: bold; background-color: #f3f4f6; color: #374151; width: 22%; text-transform: uppercase; }
          .meta-val { color: #111827; font-weight: 600; }

          .log-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          .log-table th { background-color: #065f46; color: #ffffff; padding: 10px; font-size: 12px; text-align: left; text-transform: uppercase; letter-spacing: 0.5px; }
          .log-table td { padding: 10px 12px; border: 1px solid #d1d5db; font-size: 11px; vertical-align: top; }
          .date-col { width: 22%; font-weight: bold; color: #065f46; background-color: #f9fafb; }
          .sl-col { width: 6%; text-align: center; font-weight: bold; color: #6b7280; }

          .sig-table { width: 100%; margin-top: 60px; border-collapse: collapse; }
          .sig-cell { width: 33%; text-align: center; vertical-align: bottom; font-size: 11px; font-weight: bold; color: #374151; }
          .sig-line { border-top: 1px solid #9ca3af; margin-top: 50px; padding-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="org-title">MAHANADI COALFIELDS LIMITED</div>
          <div class="org-sub">(A Subsidiary of Coal India Limited) • Human Resource Development</div>
          <div class="doc-title">OFFICIAL INTERNSHIP DAILY LOGBOOK REPORT</div>
        </div>

        <table class="meta-table">
          <tr>
            <td class="meta-label">Intern Name:</td>
            <td class="meta-val">${studentName}</td>
            <td class="meta-label">Serial Number:</td>
            <td class="meta-val">${serialNo}</td>
          </tr>
          <tr>
            <td class="meta-label">Training Office:</td>
            <td class="meta-val">${area} Area</td>
            <td class="meta-label">College / University:</td>
            <td class="meta-val">${internship?.student?.university || 'N/A'}</td>
          </tr>
          <tr>
            <td class="meta-label">Branch / Department:</td>
            <td class="meta-val">${internship?.student?.wing || 'HRD / Technical'}</td>
            <td class="meta-label">Roll Number:</td>
            <td class="meta-val">${internship?.student?.roll_no || 'N/A'}</td>
          </tr>
          <tr>
            <td class="meta-label">Internship Tenure:</td>
            <td class="meta-val">${internship?.start_date} to ${internship?.end_date}</td>
            <td class="meta-label">Total Logs Recorded:</td>
            <td class="meta-val">${logbooks.length} Working Days</td>
          </tr>
        </table>

        <table class="log-table">
          <thead>
            <tr>
              <th class="sl-col">#</th>
              <th style="width: 22%;">Date &amp; Day</th>
              <th style="width: 72%;">Daily Tasks, Field Work &amp; Learnings</th>
            </tr>
          </thead>
          <tbody>
    `

    logbooks.forEach((log, index) => {
      const d = new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })
      const safeContent = (log.content || '').replace(/\n/g, '<br/>')
      html += `
        <tr>
          <td class="sl-col">${index + 1}</td>
          <td class="date-col">${d}</td>
          <td>${safeContent}</td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>

        <table class="sig-table">
          <tr>
            <td class="sig-cell">
              <div class="sig-line">Candidate Signature</div>
            </td>
            <td class="sig-cell">
              <div class="sig-line">Assigned Mentor Signature</div>
            </td>
            <td class="sig-cell">
              <div class="sig-line">GM (HRD) / Training Officer</div>
            </td>
          </tr>
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
        <title>MCL Daily Logbook Report - ${studentName}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 15px; }
          
          .header-box { text-align: center; border-bottom: 3px double #065f46; padding-bottom: 10px; margin-bottom: 18px; }
          .org-title { color: #065f46; font-size: 22px; font-weight: 900; margin: 0; text-transform: uppercase; letter-spacing: 0.5px; }
          .org-sub { color: #4b5563; font-size: 11px; margin-top: 3px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
          .doc-badge { display: inline-block; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; padding: 4px 16px; font-size: 11px; font-weight: 800; border-radius: 20px; margin-top: 8px; text-transform: uppercase; }

          .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; background: #f9fafb; padding: 12px 16px; border-radius: 10px; border: 1px solid #e5e7eb; margin-bottom: 20px; font-size: 11px; }
          .meta-item { display: flex; flex-direction: column; }
          .meta-label { text-transform: uppercase; font-size: 9px; color: #6b7280; font-weight: 800; letter-spacing: 0.5px; }
          .meta-val { font-weight: 700; color: #111827; margin-top: 1px; }

          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background: #065f46; color: #ffffff; text-align: left; padding: 9px 12px; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
          td { padding: 9px 12px; border-bottom: 1px solid #e5e7eb; font-size: 11px; vertical-align: top; line-height: 1.5; }
          tr:nth-child(even) { background: #f9fafb; }
          .sl { font-weight: 800; color: #6b7280; text-align: center; }
          .date { font-weight: 800; color: #065f46; white-space: nowrap; }

          .sig-section { margin-top: 50px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; }
          .sig-box { border-top: 1px solid #9ca3af; padding-top: 6px; font-size: 10px; font-weight: 800; color: #374151; text-transform: uppercase; }

          .footer { margin-top: 30px; text-align: justify; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 8px; }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div class="org-title">MAHANADI COALFIELDS LIMITED</div>
          <div class="org-sub">(A Subsidiary of Coal India Limited) • HRD Department</div>
          <div class="doc-badge">OFFICIAL INTERNSHIP DAILY LOGBOOK REPORT</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item"><span class="meta-label">Intern Candidate Name</span><span class="meta-val">${studentName}</span></div>
          <div class="meta-item"><span class="meta-label">Internship Serial Number</span><span class="meta-val">${serialNo}</span></div>
          <div class="meta-item"><span class="meta-label">Training Office Area</span><span class="meta-val">${area} Area</span></div>
          <div class="meta-item"><span class="meta-label">College / University</span><span class="meta-val">${internship?.student?.university || 'N/A'}</span></div>
          <div class="meta-item"><span class="meta-label">Internship Tenure</span><span class="meta-val">${internship?.start_date} to ${internship?.end_date}</span></div>
          <div class="meta-item"><span class="meta-label">Total Daily Logs Submitted</span><span class="meta-val">${logbooks.length} Working Days</span></div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 6%; text-align: center;">#</th>
              <th style="width: 22%;">Date &amp; Day</th>
              <th style="width: 72%;">Daily Tasks, Work Done &amp; Learnings</th>
            </tr>
          </thead>
          <tbody>
    `

    logbooks.forEach((log, idx) => {
      const d = new Date(log.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', weekday: 'short' })
      const safeContent = (log.content || '').replace(/\n/g, '<br/>')
      html += `
        <tr>
          <td class="sl">${idx + 1}</td>
          <td class="date">${d}</td>
          <td>${safeContent}</td>
        </tr>
      `
    })

    html += `
          </tbody>
        </table>

        <div class="sig-section">
          <div class="sig-box">Candidate Signature</div>
          <div class="sig-box">Assigned Mentor Signature</div>
          <div class="sig-box">GM (HRD) / Training Officer</div>
        </div>

        <div class="footer">
          <span>MCL Digital Internship Portal • Verified Record</span>
          <span>Generated on ${new Date().toLocaleDateString('en-IN')}</span>
        </div>

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

  // Filtered logbooks for search
  const filteredLogbooks = logbooks.filter(log => {
    if (!searchQuery.trim()) return true
    return log.content.toLowerCase().includes(searchQuery.toLowerCase()) || log.date.includes(searchQuery)
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-3 text-emerald-600 font-semibold text-sm animate-pulse">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          Loading your logbook diary...
        </div>
      </div>
    )
  }

  if (!internship) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center max-w-lg mx-auto space-y-3">
        <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto text-xl font-bold">
          ⚠️
        </div>
        <h2 className="text-lg font-bold text-gray-800">No Active Internship Record</h2>
        <p className="text-xs text-gray-500">Your profile is not linked to an active internship tenure. Please contact your training coordinator.</p>
      </div>
    )
  }

  // Calculate statistics
  const totalDays = internship.start_date && internship.end_date 
    ? Math.ceil((new Date(internship.end_date).getTime() - new Date(internship.start_date).getTime()) / (1000 * 3600 * 24))
    : 30
  const completionPercent = Math.min(100, Math.round((logbooks.length / Math.max(1, totalDays)) * 100))

  return (
    <div className="max-w-6xl space-y-6 pb-12">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-emerald-850 via-emerald-800 to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-md">
                📖 Student Logbook &amp; Learning Diary
              </span>
              {internship.serial_no && (
                <span className="bg-white/10 text-white border border-white/20 text-xs font-mono px-3 py-1 rounded-full">
                  MCL/HRD/INT/{internship.serial_no}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Daily Training Logbook
            </h1>
            <p className="text-emerald-100/80 text-xs md:text-sm max-w-xl leading-relaxed">
              Log your daily accomplishments, technical learnings, and field observations. These entries are periodically reviewed by your assigned mentor for internship certification.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleDownloadPDF}
              disabled={!logbooks.length}
              className="bg-white hover:bg-emerald-50 text-emerald-900 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="text-base">📄</span> Export PDF
            </button>
            <button
              onClick={handleDownloadWord}
              disabled={!logbooks.length}
              className="bg-emerald-700/80 hover:bg-emerald-700 text-white border border-emerald-400/30 font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none"
            >
              <span className="text-base">📝</span> Export Word
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-lg">
            📝
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Total Entries</p>
            <p className="text-lg font-black text-gray-900">{logbooks.length} Days</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-lg">
            📅
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Tenure Range</p>
            <p className="text-xs font-bold text-gray-800">{internship.start_date} → {internship.end_date}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-lg">
            📊
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Consistency</p>
            <p className="text-lg font-black text-gray-900">{completionPercent}% Recorded</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-lg">
            🏛️
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Training Office</p>
            <p className="text-xs font-bold text-gray-800">{internship.area || 'Headquarters'} Area</p>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <span>⚠️</span> {error}
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <span>✓</span> {success}
        </div>
      )}

      {/* Main Grid: Form + Timeline */}
      <div className="grid md:grid-cols-5 gap-6 items-start">
        {/* Editor Form Column */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-gray-50 pb-3">
              <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <span>✍️</span> Write Daily Entry
              </h2>
              <button
                type="button"
                onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
                className="text-[11px] text-emerald-700 hover:text-emerald-800 font-semibold bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg transition-colors"
              >
                Today
              </button>
            </div>

            <form onSubmit={handleSaveLog} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  min={internship.start_date}
                  max={internship.end_date}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                  Category Tag
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categoryTags.map(tag => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTag(tag)
                        if (!content.startsWith(`[${tag}]`)) {
                          setContent(prev => `[${tag}] ` + prev.replace(/^\[.*?\]\s*/, ''))
                        }
                      }}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-lg transition-colors border ${
                        selectedTag === tag 
                          ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                          : 'bg-gray-50 text-gray-600 border-gray-150 hover:bg-gray-100'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    Tasks &amp; Learnings
                  </label>
                  <span className="text-[10px] text-gray-400">{content.length} chars</span>
                </div>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Describe the tasks completed today, guidance received from mentor, and key learnings..."
                  rows={7}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none leading-relaxed"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !content.trim()}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving Entry...</span>
                  </>
                ) : (
                  <>
                    <span>💾</span> Save Log Entry
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <span>💡</span> Pro Tip
            </p>
            <p className="text-emerald-700 leading-relaxed">
              Writing a log entry for a date you already submitted will automatically update that day&apos;s record!
            </p>
          </div>
        </div>

        {/* Logbook Timeline Column */}
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-50 pb-3">
              <div>
                <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <span>📜</span> Timeline Logs ({logbooks.length})
                </h2>
              </div>

              {/* Search Bar */}
              {logbooks.length > 0 && (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search logs by keyword..."
                    className="w-full sm:w-56 text-xs border border-gray-200 rounded-xl px-3 py-1.5 pl-8 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute left-2.5 top-1.5 text-xs text-gray-400">🔍</span>
                </div>
              )}
            </div>

            {!logbooks.length ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto text-xl">
                  📖
                </div>
                <p className="text-sm font-bold text-gray-800">No Daily Logs Recorded Yet</p>
                <p className="text-xs text-gray-400 max-w-xs mx-auto">Use the log editor on the left to write your first entry for today!</p>
              </div>
            ) : !filteredLogbooks.length ? (
              <div className="text-center py-12 text-xs text-gray-400">
                No logbook entries match your search query &quot;{searchQuery}&quot;.
              </div>
            ) : (
              <div className="relative border-l-2 border-emerald-100 pl-5 ml-3 space-y-6 pt-2">
                {filteredLogbooks.map((log) => {
                  const dateObj = new Date(log.date)
                  const formattedDate = dateObj.toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    weekday: 'short'
                  })

                  return (
                    <div key={log.id} className="relative group">
                      {/* Circle Timeline Marker */}
                      <div className="absolute -left-[27px] top-1 w-3.5 h-3.5 rounded-full bg-emerald-600 ring-4 ring-emerald-50 group-hover:ring-emerald-100 transition-all" />

                      <div className="bg-gray-50/60 hover:bg-emerald-50/30 border border-gray-150 hover:border-emerald-200 rounded-2xl p-4 transition-all space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-emerald-800 bg-emerald-100/70 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            {formattedDate}
                          </span>
                          <span className="text-[10px] font-semibold text-gray-400">
                            Logged {new Date(log.created_at || log.date).toLocaleDateString('en-IN')}
                          </span>
                        </div>

                        <p className="text-xs text-gray-800 whitespace-pre-wrap leading-relaxed pt-1">
                          {log.content}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
