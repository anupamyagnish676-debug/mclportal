'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function AdminAreasPage() {
  const supabase = createClient()
  const router = useRouter()
  const [areas, setAreas] = useState<any[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function checkAuthAndLoad() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, area')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile || profile.role !== 'admin' || profile.area !== 'Headquarters') {
        setIsAuthorized(false)
        setAuthLoading(false)
        setLoading(false)
        return
      }

      setIsAuthorized(true)
      setAuthLoading(false)
      await loadAreas()
    } catch (err: any) {
      setError(err.message)
      setAuthLoading(false)
      setLoading(false)
    }
  }

  async function loadAreas() {
    setLoading(true)
    try {
      const res = await fetch('/api/areas')
      const data = await res.json()
      if (res.ok) {
        setAreas(data.areas || [])
      } else {
        setError(data.error || 'Failed to load areas')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    checkAuthAndLoad()
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch('/api/areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() })
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(`Area "${name}" created successfully!`)
        setName('')
        await loadAreas()
      } else {
        setError(data.error || 'Failed to create area')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setSaving(false)
  }

  async function handleDelete(id: string, areaName: string) {
    if (id.startsWith('default-')) {
      alert('Cannot delete default areas before database table creation is completed.')
      return
    }
    if (!confirm(`Are you sure you want to delete the training area "${areaName}"?\n\nWarning: Any profile or internship assigned to this area will remain, but the area will no longer appear in administrative menus.`)) return
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/areas?id=${id}`, {
        method: 'DELETE'
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(`Area "${areaName}" deleted successfully.`)
        await loadAreas()
      } else {
        setError(data.error || 'Failed to delete area')
      }
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (authLoading) {
    return <div className="p-8 text-gray-500 text-sm">Verifying authorization...</div>
  }

  if (!isAuthorized) {
    return (
      <div className="p-8 text-center max-w-md mx-auto space-y-3">
        <span className="text-4xl">🚫</span>
        <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
        <p className="text-gray-500 text-sm">
          Only Headquarters (Global) Admins have permission to manage training office areas.
        </p>
        <a href="/admin" className="inline-block px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold text-xs rounded-lg shadow">
          Return to Dashboard
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Areas Manager</h1>
      <p className="text-gray-500 text-sm mb-6">Manage the official training offices/areas for MCL decentralization.</p>

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
        {/* Create Area Form */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Add Training Area</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Area Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ib Valley"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating...' : 'Create Area'}
              </button>
            </form>
          </div>
        </div>

        {/* Areas List */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Existing Areas / Offices</h2>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading areas...</div>
            ) : !areas.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No areas registered yet.
              </div>
            ) : (
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                {areas.map(area => (
                  <div key={area.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50/55 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{area.name} Area</p>
                      {area.id.startsWith('default-') ? (
                        <span className="text-[9px] font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          Seed Default
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-400">
                          Added on {new Date(area.created_at).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </div>
                    {!area.id.startsWith('default-') && (
                      <button
                        onClick={() => handleDelete(area.id, area.name)}
                        className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                      >
                        Delete
                      </button>
                    )}
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
