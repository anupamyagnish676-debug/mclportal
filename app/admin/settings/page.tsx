'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import SettingsForm from '@/components/SettingsForm'

export default function AdminSettingsPage() {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [savedSignature, setSavedSignature] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  // Load current saved signature from profile
  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data, error } = await supabase
        .from('profiles')
        .select('signature_data')
        .eq('id', user.id)
        .maybeSingle()
      
      if (data?.signature_data) {
        setSavedSignature(data.signature_data)
      }
    }
    loadProfile()
  }, [])

  // Prevent touch scrolling when drawing on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const preventDefault = (e: TouchEvent) => {
      if (e.target === canvas) {
        e.preventDefault()
      }
    }

    document.body.addEventListener('touchstart', preventDefault, { passive: false })
    document.body.addEventListener('touchmove', preventDefault, { passive: false })
    document.body.addEventListener('touchend', preventDefault, { passive: false })

    return () => {
      document.body.removeEventListener('touchstart', preventDefault)
      document.body.removeEventListener('touchmove', preventDefault)
      document.body.removeEventListener('touchend', preventDefault)
    }
  }, [])

  // Drawing event handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.strokeStyle = '#1e293b' // slate-800
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const rect = canvas.getBoundingClientRect()
    let x, y
    if ('touches' in e) {
      if (e.touches.length === 0) return
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.beginPath()
    ctx.moveTo(x, y)
    setIsDrawing(true)
  }

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const rect = canvas.getBoundingClientRect()
    let x, y
    if ('touches' in e) {
      if (e.touches.length === 0) return
      x = e.touches[0].clientX - rect.left
      y = e.touches[0].clientY - rect.top
    } else {
      x = e.clientX - rect.left
      y = e.clientY - rect.top
    }

    ctx.lineTo(x, y)
    ctx.stroke()
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas) return

    setLoading(true)
    setMsg('')
    setErr('')

    const signatureData = canvas.toDataURL('image/png')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setErr('Not logged in')
        setLoading(false)
        return
      }

      const { error } = await supabase
        .from('profiles')
        .update({ signature_data: signatureData })
        .eq('id', user.id)

      if (error) {
        setErr(error.message)
      } else {
        setSavedSignature(signatureData)
        setMsg('Digital signature saved successfully!')
        clearCanvas()
      }
    } catch (e: any) {
      setErr(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Account Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your password and digital signature settings</p>

      <div className="grid md:grid-cols-2 gap-8 items-start">
        {/* Password settings */}
        <SettingsForm />

        {/* Signature drawing pad */}
        <div className="bg-white rounded-xl border border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-2">Digital Signature</h2>
          <p className="text-gray-500 text-sm mb-6">Draw your signature below to be included in completion certificates as the Coordinator/Mentor.</p>

          {/* Canvas Box */}
          <div className="relative border-2 border-dashed border-gray-200 bg-gray-50 rounded-xl overflow-hidden mb-4">
            <canvas
              ref={canvasRef}
              width={400}
              height={150}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              className="w-full h-[150px] cursor-crosshair touch-none"
            />
          </div>

          <div className="flex gap-2 mb-6">
            <button
              onClick={saveSignature}
              disabled={loading}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Signature'}
            </button>
            <button
              onClick={clearCanvas}
              disabled={loading}
              className="border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Clear
            </button>
          </div>

          {msg && <p className="text-green-600 text-sm font-semibold mb-4">{msg}</p>}
          {err && <p className="text-red-600 text-sm font-semibold mb-4">{err}</p>}

          {/* Signature Preview */}
          {savedSignature && (
            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Current Signature Preview</h3>
              <div className="inline-block bg-white border border-gray-200 rounded-lg p-2.5 shadow-sm max-w-full">
                <img
                  src={savedSignature}
                  alt="Saved Digital Signature"
                  className="max-h-20 max-w-full object-contain"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
