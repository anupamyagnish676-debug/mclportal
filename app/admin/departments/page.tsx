'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminDepartmentsPage() {
  const supabase = createClient()
  const [profile, setProfile] = useState<any>(null)
  const [departments, setDepartments] = useState<any[]>([])
  const [areasList, setAreasList] = useState<string[]>([])
  const [selectedArea, setSelectedArea] = useState<string>('')
  const [deptAvailabilityMap, setDeptAvailabilityMap] = useState<Record<string, string[]>>({})
  const [areaStatusMap, setAreaStatusMap] = useState<Record<string, boolean>>({})
  const [viewMode, setViewMode] = useState<'area' | 'matrix'>('area')

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function loadData(areaName?: string) {
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLoading(false)
      return
    }

    // Fetch user profile
    const { data: prof } = await supabase.from('profiles').select('role, area').eq('id', user.id).maybeSingle()
    if (prof) {
      setProfile(prof)
      const currentArea = areaName || (prof.area === 'Headquarters' ? 'Headquarters' : prof.area)
      setSelectedArea(currentArea)
    }

    // Fetch areas list
    const { data: areasData } = await supabase.from('areas').select('name').order('name')
    if (areasData && areasData.length > 0) {
      setAreasList(areasData.map(a => a.name))
    } else {
      setAreasList(['Talcher', 'Jagannath', 'Lingaraj', 'Subhadra', 'IB Valley', 'Lakhanpur', 'Headquarters'])
    }

    // Fetch departments and area mappings
    const areaToFetch = areaName || prof?.area || 'Headquarters'
    try {
      const res = await fetch(`/api/admin/area-departments?area=${encodeURIComponent(areaToFetch)}`)
      const data = await res.json()
      if (res.ok) {
        setDepartments(data.departments || [])
        setAreaStatusMap(data.areaStatusMap || {})
        setDeptAvailabilityMap(data.deptAvailabilityMap || {})
      } else {
        setError(data.error || 'Failed to load department mapping')
      }
    } catch (err: any) {
      setError(err.message || 'Error fetching department data')
    }

    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    const { error: err } = await supabase
      .from('departments')
      .insert({ name: name.trim() })

    if (err) {
      setError(err.message)
    } else {
      setSuccess(`Department "${name}" created globally!`)
      setName('')
      loadData(selectedArea)
    }
    setSaving(false)
  }

  async function handleToggleAreaDepartment(deptName: string, currentStatus: boolean, specificArea?: string) {
    setError('')
    setSuccess('')
    const targetArea = specificArea || selectedArea || profile?.area || 'Headquarters'

    try {
      const res = await fetch('/api/admin/area-departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          area: targetArea,
          department_name: deptName,
          is_active: !currentStatus
        })
      })

      const data = await res.json()
      if (res.ok) {
        setSuccess(`Department "${deptName}" is now ${!currentStatus ? 'ACTIVE' : 'INACTIVE'} in ${targetArea} Area.`)
        loadData(selectedArea)
      } else {
        setError(data.error || 'Failed to update department status')
      }
    } catch (err: any) {
      setError(err.message || 'Error updating status')
    }
  }

  async function handleDelete(id: string, deptName: string) {
    if (!confirm(`Are you sure you want to delete the department "${deptName}" globally?`)) return
    setError('')
    setSuccess('')

    const { error: err } = await supabase
      .from('departments')
      .delete()
      .eq('id', id)

    if (err) {
      setError(err.message)
    } else {
      setSuccess(`Department "${deptName}" deleted successfully.`)
      loadData(selectedArea)
    }
  }

  const isHqAdmin = profile?.role === 'admin' && profile?.area === 'Headquarters'

  return (
    <div className="max-w-6xl space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-850 via-emerald-800 to-teal-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 text-xs font-semibold px-3 py-1 rounded-full backdrop-blur-md">
            🏛️ Department &amp; Wing Configuration
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight mt-2">Area Department Manager</h1>
          <p className="text-emerald-100/80 text-xs mt-1">
            Configure active internship departments in {selectedArea || 'your Area'} so student applications and referrals are routed correctly.
          </p>
        </div>

        {/* View Mode Toggle & Area Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-white/10 p-1 rounded-2xl border border-white/20 backdrop-blur-md flex items-center gap-1">
            <button
              onClick={() => setViewMode('area')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'area' ? 'bg-white text-emerald-950 shadow-sm' : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              🏢 Area View
            </button>
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                viewMode === 'matrix' ? 'bg-white text-emerald-950 shadow-sm' : 'text-emerald-100 hover:bg-white/10'
              }`}
            >
              🌐 Company Matrix Grid
            </button>
          </div>

          {isHqAdmin && viewMode === 'area' && areasList.length > 0 && (
            <div className="bg-white/10 border border-white/20 p-2.5 rounded-2xl flex items-center gap-2 backdrop-blur-md">
              <span className="text-xs font-semibold text-emerald-200">Select Area:</span>
              <select
                value={selectedArea}
                onChange={e => loadData(e.target.value)}
                className="bg-emerald-900/90 text-white font-bold text-xs border border-emerald-500/40 rounded-xl px-3 py-1.5 focus:outline-none"
              >
                {areasList.map(areaName => (
                  <option key={areaName} value={areaName}>{areaName} Area</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs font-semibold">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl text-xs font-semibold">
          ✓ {success}
        </div>
      )}

      {/* VIEW MODE 1: AREA-SPECIFIC VIEW */}
      {viewMode === 'area' ? (
        <div className="grid md:grid-cols-5 gap-6">
          {/* Create Department Form */}
          <div className="md:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                <span>➕</span> Add New Global Department
              </h2>
              <form onSubmit={handleAdd} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                    Department Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Geology &amp; Exploration"
                    className="w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Department'}
                </button>
              </form>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 text-xs text-emerald-900 space-y-1">
              <p className="font-bold flex items-center gap-1">
                <span>💡</span> How Area Toggling Works
              </p>
              <p className="text-emerald-800 leading-relaxed">
                Enabling a department marks it as <strong>Active</strong> in {selectedArea || 'your Area'}. If an intern applies with a wing not enabled here, the portal alerts you to shift them to an area where that wing is active!
              </p>
            </div>
          </div>

          {/* Departments List with Area Toggles */}
          <div className="md:col-span-3">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-gray-50 pb-3">
                <div>
                  <h2 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                    <span>🏢</span> Departments List in <span className="text-emerald-700 font-extrabold">{selectedArea} Area</span>
                  </h2>
                  <p className="text-[11px] text-gray-400">Toggle active status for {selectedArea} Area</p>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-12 text-gray-400 text-sm animate-pulse">Loading departments...</div>
              ) : !departments.length ? (
                <div className="text-center py-12 text-gray-400 text-sm">
                  No departments registered yet. Use the form on the left to add one!
                </div>
              ) : (
                <div className="border border-gray-100 rounded-xl divide-y divide-gray-100">
                  {departments.map(dept => {
                    const isActiveInArea = areaStatusMap[dept.name] ?? true // default active unless toggled off
                    const activeAreas = deptAvailabilityMap[dept.name] || []

                    return (
                      <div key={dept.id} className="flex items-center justify-between p-4 hover:bg-gray-50/70 transition-colors gap-3">
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-gray-900">{dept.name}</p>
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className={`px-2 py-0.5 rounded-full font-bold border ${
                              isActiveInArea 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-red-50 text-red-600 border-red-200'
                            }`}>
                              {isActiveInArea ? `✓ Active in ${selectedArea}` : `✕ Not Active in ${selectedArea}`}
                            </span>
                            {activeAreas.length > 0 && (
                              <span className="text-gray-400">
                                (Active in {activeAreas.length} Areas)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleToggleAreaDepartment(dept.name, isActiveInArea)}
                            className={`px-3 py-1.5 text-xs font-bold rounded-xl border transition-all ${
                              isActiveInArea
                                ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {isActiveInArea ? 'Disable in Area' : 'Enable in Area'}
                          </button>

                          {isHqAdmin && (
                            <button
                              onClick={() => handleDelete(dept.id, dept.name)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Department Globally"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: COMPANY-WIDE MATRIX GRID */
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <span>🌐</span> Master Company-Wide Area-Department Availability Matrix
              </h2>
              <p className="text-xs text-gray-500">
                Click any cell pill to toggle department active status for that specific MCL Area.
              </p>
            </div>
            <span className="bg-emerald-50 text-emerald-800 text-xs font-bold px-3 py-1 rounded-full border border-emerald-200">
              {departments.length} Departments × {areasList.length} MCL Areas
            </span>
          </div>

          <div className="overflow-x-auto border border-gray-100 rounded-2xl">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-700 font-bold uppercase tracking-wider">
                <tr>
                  <th className="p-3.5 min-w-[200px]">Department / Wing</th>
                  {areasList.map(areaName => (
                    <th key={areaName} className="p-3 text-center min-w-[110px]">
                      {areaName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {departments.map(dept => {
                  const activeAreas = deptAvailabilityMap[dept.name] || []
                  return (
                    <tr key={dept.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-3.5 font-bold text-gray-900 bg-gray-50/30">
                        {dept.name}
                      </td>
                      {areasList.map(areaName => {
                        const isActiveInThisArea = activeAreas.includes(areaName)
                        return (
                          <td key={areaName} className="p-2 text-center">
                            <button
                              onClick={() => handleToggleAreaDepartment(dept.name, isActiveInThisArea, areaName)}
                              className={`w-full py-1.5 px-2 rounded-lg font-bold text-[11px] transition-all border ${
                                isActiveInThisArea
                                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 shadow-2xs'
                                  : 'bg-gray-50 hover:bg-red-50 text-gray-400 hover:text-red-600 border-gray-200 hover:border-red-200'
                              }`}
                            >
                              {isActiveInThisArea ? '✓ Active' : '✕ Inactive'}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
