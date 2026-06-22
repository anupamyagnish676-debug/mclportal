'use client'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AreaSelector({ 
  selectedArea,
  areas = []
}: { 
  selectedArea: string
  areas?: { name: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const tab = searchParams.get('tab') || 'active'

  return (
    <select
      value={selectedArea}
      onChange={e => {
        const area = e.target.value
        const params = new URLSearchParams()
        params.set('tab', tab)
        if (area) {
          params.set('area', area)
        }
        router.push(`/admin/interns?${params.toString()}`)
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
  )
}
