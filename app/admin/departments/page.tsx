'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function AdminDepartmentsPage() {
  const supabase = createClient()
  const [departments, setDepartments] = useState<any[]>([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function load() {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('departments')
      .select('*')
      .order('name')
    if (err) {
      setError(err.message)
    } else {
      setDepartments(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    load()
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
      setSuccess(`Department "${name}" created successfully!`)
      setName('')
      load()
    }
    setSaving(false)
  }

  async function handleDelete(id: string, deptName: string) {
    if (!confirm(`Are you sure you want to delete the department "${deptName}"?`)) return
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
      load()
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Departments Manager</h1>
      <p className="text-gray-500 text-sm mb-6">Manage the official internship departments/wings at Mahanadi Coalfields Limited.</p>

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
        {/* Create Department Form */}
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Add Department</h2>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Department Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Electrical Engineering"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full bg-green-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Creating...' : 'Create Department'}
              </button>
            </form>
          </div>
        </div>

        {/* Departments List */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="font-bold text-gray-800 text-sm mb-4">Existing Departments</h2>

            {loading ? (
              <div className="text-center py-6 text-gray-400 text-sm">Loading departments...</div>
            ) : !departments.length ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No departments registered yet.
              </div>
            ) : (
              <div className="border border-gray-100 rounded-lg divide-y divide-gray-50">
                {departments.map(dept => (
                  <div key={dept.id} className="flex items-center justify-between p-3.5 hover:bg-gray-50/55 transition-colors">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{dept.name}</p>
                      <span className="text-[10px] text-gray-400">
                        Added on {new Date(dept.created_at).toLocaleDateString('en-IN')}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDelete(dept.id, dept.name)}
                      className="px-2.5 py-1 text-xs text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    >
                      Delete
                    </button>
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
