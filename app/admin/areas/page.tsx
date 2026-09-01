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

  const [userArea, setUserArea] = useState<string>('')
  const [isHqAdmin, setIsHqAdmin] = useState(false)
  const [editingFolderId, setEditingFolderId] = useState<Record<string, string>>({})
  const [updatingArea, setUpdatingArea] = useState<string | null>(null)

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

      if (!profile || profile.role !== 'admin') {
        setIsAuthorized(false)
      const res = await fetch('/api/admin/profile')
      const profileData = await res.json()

      const userAreaName = profileData?.area || ''
      const isHq = userAreaName === 'Headquarters' || (profileData?.role === 'admin' && (!userAreaName || userAreaName === 'Headquarters'))

      setUserArea(userAreaName)
      setIsHqAdmin(isHq)

      setIsAuthorized(true)
      setAuthLoading(false)
      await loadAreas(userAreaName, isHq)
    } catch (err: any) {
      setError(err.message)
      setAuthLoading(false)
      setLoading(false)
    }
  }

  async function loadAreas(areaName?: string, isHq?: boolean) {
    setLoading(true)
    try {
      const res = await fetch('/api/areas')
      const data = await res.json()
      if (res.ok) {
        let allAreas = data.areas || []
        const currentIsHq = isHq ?? isHqAdmin
        const currentArea = areaName ?? userArea
        
        // Scope to user's area if not HQ Admin
        if (!currentIsHq && currentArea) {
          allAreas = allAreas.filter((a: any) => a.name === currentArea)
        }

        setAreas(allAreas)
        const initMap: Record<string, string> = {}
        const initEmailMap: Record<string, string> = {}
        allAreas.forEach((a: any) => {
          initMap[a.name] = a.gdrive_folder_id || ''
          initEmailMap[a.name] = a.owner_email || ''
        })
        setEditingFolderId(initMap)
        setEditingOwnerEmail(initEmailMap)
      } else {
        setError(data.error || 'Failed to load areas')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setLoading(false)
  }

  async function handleSaveDriveFolder(areaName: string) {
    setUpdatingArea(areaName)
    setError('')
    setSuccess('')

    try {
      const folderId = editingFolderId[areaName] || ''
      const ownerEmail = editingOwnerEmail[areaName] || ''
      const res = await fetch('/api/areas', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areaName, gdrive_folder_id: folderId, owner_email: ownerEmail })
      })
      const data = await res.json()

      if (res.ok) {
        setSuccess(`Google Drive storage and owner email updated for ${areaName} Area!`)
        await loadAreas()
      } else {
        setError(data.error || 'Failed to update Google Drive settings')
      }
    } catch (err: any) {
      setError(err.message)
    }
    setUpdatingArea(null)
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
        {/* Create Area Form & GDrive Instructions */}
        <div className={`${isHqAdmin ? 'md:col-span-2' : 'md:col-span-5 lg:col-span-2'} space-y-6`}>
          {isHqAdmin && (
            <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
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
          )}

          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">📁</span>
              <h3 className="font-bold text-emerald-900 text-xs uppercase tracking-wide">Decentralized Drive Setup Guide</h3>
            </div>
            <ol className="text-xs text-emerald-800 space-y-2 list-decimal list-inside leading-relaxed font-medium">
              <li>Open your Area&apos;s Google Drive (<code className="bg-white/80 px-1 py-0.5 rounded text-[11px]">drive.google.com</code>) &amp; create a folder (e.g. <strong>MCL {userArea || 'Talcher'} Storage</strong>).</li>
              <li>Right-click folder → <strong>Share</strong> → add system email <code className="bg-white px-1.5 py-0.5 rounded font-mono font-bold text-emerald-900 border border-emerald-200 select-all">mclinternshipportal@gmail.com</code> with <strong>Editor</strong> permission.</li>
              <li>Open the folder and copy the ID from URL (<code className="bg-white/80 px-1 py-0.5 rounded text-[10px]">drive.google.com/drive/folders/<strong>1A2b3C...</strong></code>).</li>
              <li>Paste the Folder ID next to your area on the right and click <strong>Save Storage</strong>.</li>
            </ol>
          </div>
        </div>

        {/* Areas List with GDrive Folder Configuration */}
        <div className={`${isHqAdmin ? 'md:col-span-3' : 'md:col-span-5 lg:col-span-3'}`}>
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-gray-800 text-sm">Decentralized Area Storage Configuration</h2>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading areas...</div>
            ) : !areas.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No areas registered yet.
              </div>
            ) : (
              <div className="space-y-4">
                {areas.map(area => {
                  const currentFolderId = editingFolderId[area.name] ?? (area.gdrive_folder_id || '')
                  const currentOwnerEmail = editingOwnerEmail[area.name] ?? (area.owner_email || '')
                  const isUpdating = updatingArea === area.name
                  const hasCustomDrive = Boolean(area.gdrive_folder_id)

                  return (
                    <div key={area.id} className="p-4 rounded-xl border border-gray-150 bg-gray-50/40 space-y-3 hover:border-green-200 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {area.name === 'Headquarters' ? 'Headquarters (Central)' : `${area.name} Area`}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                              hasCustomDrive 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}>
                              {hasCustomDrive ? '✓ Area Google Drive Connected' : '⚡ Using Fallback HQ Drive'}
                            </span>
                            {area.owner_email && (
                              <span className="text-[10px] text-gray-500 font-mono">
                                👤 {area.owner_email}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleSaveDriveFolder(area.name)}
                          disabled={isUpdating}
                          className="bg-green-700 text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-green-800 disabled:opacity-50 transition-colors flex-shrink-0 shadow-sm"
                        >
                          {isUpdating ? 'Saving...' : 'Save Settings'}
                        </button>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Google Drive Folder ID
                          </label>
                          <input
                            type="text"
                            value={currentFolderId}
                            onChange={e => setEditingFolderId(prev => ({ ...prev, [area.name]: e.target.value }))}
                            placeholder="e.g. 1A2b3C4d5e6F7g8H9i..."
                            className="w-full font-mono text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                            Owner Google Account (for 15 GB Quota)
                          </label>
                          <input
                            type="email"
                            value={currentOwnerEmail}
                            onChange={e => setEditingOwnerEmail(prev => ({ ...prev, [area.name]: e.target.value }))}
                            placeholder="e.g. talcher.area.mcl@gmail.com"
                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                        </div>
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
