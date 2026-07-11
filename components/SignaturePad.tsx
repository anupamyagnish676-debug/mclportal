'use client'
import { useRef, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Pen, Trash2, Check } from 'lucide-react'

interface SignaturePadProps {
  existingSignature?: string | null
  onSaved?: () => void
}

export default function SignaturePad({ existingSignature, onSaved }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [currentSig, setCurrentSig] = useState<string | null>(existingSignature || null)
  const supabase = createClient()

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a1a'
  }, [])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasDrawn(true)
    setMessage(null)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function stopDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    setIsDrawing(false)
  }

  function clearPad() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
    setMessage(null)
  }

  async function saveSignature() {
    const canvas = canvasRef.current!
    if (!hasDrawn) {
      setMessage({ type: 'error', text: 'Please draw your signature before saving.' })
      return
    }
    setSaving(true)
    setMessage(null)
    try {
      const signatureData = canvas.toDataURL('image/png')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase
        .from('profiles')
        .update({ signature_data: signatureData })
        .eq('id', user.id)

      if (error) throw new Error(error.message)

      setCurrentSig(signatureData)
      setMessage({ type: 'success', text: 'Signature saved successfully!' })
      onSaved?.()
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save signature.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Current saved signature preview */}
      {currentSig && (
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Current Saved Signature</p>
          <img
            src={currentSig}
            alt="Current signature"
            className="h-14 object-contain border border-gray-200 rounded-lg bg-white px-3 py-1"
          />
        </div>
      )}

      {/* Drawing canvas */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
            <Pen className="w-3 h-3" />
            {currentSig ? 'Draw New Signature' : 'Draw Your Signature'}
          </p>
          <button
            type="button"
            onClick={clearPad}
            className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
            Clear
          </button>
        </div>

        <canvas
          ref={canvasRef}
          width={520}
          height={160}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
          className="w-full h-32 border-2 border-dashed border-gray-200 rounded-xl bg-white cursor-crosshair touch-none"
          style={{ touchAction: 'none' }}
        />
        <p className="text-[10px] text-gray-400 text-center italic">
          Sign above using your mouse or touchscreen
        </p>
      </div>

      {message && (
        <div className={`px-4 py-2.5 rounded-xl text-xs border ${
          message.type === 'success'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
        </div>
      )}

      <button
        type="button"
        onClick={saveSignature}
        disabled={saving || !hasDrawn}
        className="flex items-center gap-2 px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        {saving ? 'Saving...' : 'Save Signature'}
      </button>
    </div>
  )
}
