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
        .select('id, start_date, end_date')
        .eq('student_id', user.id)
        .maybeSingle()

      if (intErr) {
        setError(intErr.message)
        setLoading(false)
        return
      }

      if (intern) {
        setInternship(intern)
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
            <h2 className="font-semibold text-gray-800 mb-4">Logbook Timeline</h2>
            
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
