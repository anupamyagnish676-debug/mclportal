'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminBulkOnboardingPage() {
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [students, setStudents] = useState<any[]>([])
  const [adminProfile, setAdminProfile] = useState<{ role: string; area: string | null } | null>(null)
  const [areas, setAreas] = useState<any[]>([])
  const [selectedArea, setSelectedArea] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAreas() {
      try {
        const res = await fetch('/api/areas')
        const data = await res.json()
        if (res.ok) {
          setAreas(data.areas || [])
        }
      } catch (err) {
        console.error('Failed to load areas:', err)
      }
    }
    loadAreas()
    async function loadAdmin() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('role, area')
          .eq('id', user.id)
          .maybeSingle()
        if (data) {
          setAdminProfile(data)
          if (data.area && data.area !== 'Headquarters') {
            setSelectedArea(data.area)
          }
        }
      }
    }
    loadAdmin()
  }, [])

  // Helper to trigger blank CSV template download
  function downloadTemplate() {
    const headers = 'full_name,email,password,roll_no,university,wing,start_date,end_date\n'
    const sample = 'Rahul Sharma,rahul@example.com,Password@123,2021CSE088,KIIT University,Computer Science & IT,2026-07-01,2026-08-31\n'
    const blob = new Blob([headers + sample], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'mcl_bulk_onboarding_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  // Parse CSV file content safely
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) {
        setError('Empty file content')
        return
      }

      const rows = text.split(/\r?\n/).map(row => {
        // Parse CSV values taking double quotes into consideration
        const columns: string[] = []
        let current = ''
        let inQuotes = false
        for (let i = 0; i < row.length; i++) {
          const char = row[i]
          if (char === '"') {
            inQuotes = !inQuotes
          } else if (char === ',' && !inQuotes) {
            columns.push(current.trim())
            current = ''
          } else {
            current += char
          }
        }
        columns.push(current.trim())
        return columns
      }).filter(cols => cols.length > 1 && cols.some(col => col.length > 0))

      if (rows.length < 2) {
        setError('CSV must contain a header row and at least one student record.')
        return
      }

      const headers = rows[0].map(h => h.toLowerCase().replace(/["'\s]/g, ''))
      const parsedStudents = rows.slice(1).map(row => {
        const student: any = {}
        headers.forEach((header, index) => {
          student[header] = row[index]?.replace(/^["']|["']$/g, '') || ''
        })
        return student
      })

      // Validate required columns
      const required = ['full_name', 'email', 'password']
      const missing = required.filter(field => !headers.includes(field))
      if (missing.length > 0) {
        setError(`Missing required columns in CSV: ${missing.join(', ')}`)
        setStudents([])
      } else {
        setStudents(parsedStudents)
      }
    }
    reader.readAsText(selectedFile)
  }

  async function handleOnboard() {
    if (!students.length) return
    if (adminProfile?.area === 'Headquarters' && !selectedArea) {
      setError('Please select an Office / Area to onboard students into.')
      return
    }
    setLoading(true)
    setError('')
    setResults(null)

    try {
      const res = await fetch('/api/bulk-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ students, defaultArea: selectedArea })
      })

      const data = await res.json()
      if (res.ok) {
        setResults(data.results || [])
        setStudents([])
        setFile(null)
      } else {
        setError(data.error || 'Failed to onboard students')
      }
    } catch (err: any) {
      setError(err.message || 'Server error occurred')
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Bulk Onboarding</h1>
          <p className="text-gray-500 text-sm">Register dozens of interns simultaneously using a CSV spreadsheet.</p>
        </div>
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 border border-gray-255 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          📥 Download CSV Template
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {/* Main interface */}
      <div className="grid md:grid-cols-3 gap-6">
        {/* Upload Box */}
        <div className="md:col-span-1 space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Upload CSV File</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-green-500 transition-colors relative cursor-pointer mb-4">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <span className="text-3xl block mb-2">📄</span>
              <p className="text-xs font-semibold text-gray-700">
                {file ? file.name : 'Click or drag CSV here'}
              </p>
              <p className="text-[10px] text-gray-400 mt-1">Accepts only .csv files</p>
            </div>

            {adminProfile?.area === 'Headquarters' && students.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Onboard into Office / Area <span className="text-red-500">*</span>
                </label>
                <select 
                  value={selectedArea} 
                  onChange={e => setSelectedArea(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">-- Select Area --</option>
                  {areas.map(a => (
                    <option key={a.name} value={a.name}>
                      {a.name === 'Headquarters' ? 'Headquarters (Central)' : `${a.name} Area`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {students.length > 0 && (
              <div className="mt-4">
                <button
                  onClick={handleOnboard}
                  disabled={loading}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : `Onboard ${students.length} Student(s)`}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Preview / Results Table */}
        <div className="md:col-span-2">
          {/* Results Summary */}
          {results && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6 space-y-4">
              <h2 className="font-bold text-gray-900 text-sm">Onboarding Report Summary</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 border border-green-150 rounded-lg p-3 text-center">
                  <span className="block text-2xl font-bold text-green-700">
                    {results.filter(r => r.success).length}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-green-600">Onboarded Successfully</span>
                </div>
                <div className="bg-red-50 border border-red-150 rounded-lg p-3 text-center">
                  <span className="block text-2xl font-bold text-red-700">
                    {results.filter(r => !r.success).length}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-red-600">Errors encountered</span>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-2.5 font-bold text-gray-500">Email</th>
                      <th className="p-2.5 font-bold text-gray-500">Status</th>
                      <th className="p-2.5 font-bold text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {results.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2.5 font-semibold text-gray-700">{r.email}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                            {r.success ? 'Success' : 'Failed'}
                          </span>
                        </td>
                        <td className="p-2.5 text-gray-500">
                          {r.success ? `Serial No: ${r.serial_no}` : r.error}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* CSV Records Preview */}
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">CSV Student Preview</h2>
            {!students.length ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                No CSV uploaded yet. Upload a CSV template on the left panel to review its contents here.
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-100 rounded-lg max-h-96">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-2.5 font-bold text-gray-500">Full Name</th>
                      <th className="p-2.5 font-bold text-gray-500">Email</th>
                      <th className="p-2.5 font-bold text-gray-500">University</th>
                      <th className="p-2.5 font-bold text-gray-500">Wing</th>
                      <th className="p-2.5 font-bold text-gray-500">Dates</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, idx) => (
                      <tr key={idx}>
                        <td className="p-2.5 font-semibold text-gray-800">{s.full_name}</td>
                        <td className="p-2.5 text-gray-600">{s.email}</td>
                        <td className="p-2.5 text-gray-600">{s.university || '—'}</td>
                        <td className="p-2.5 text-gray-600">{s.wing || '—'}</td>
                        <td className="p-2.5 text-gray-500">
                          {s.start_date || '—'} to {s.end_date || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
