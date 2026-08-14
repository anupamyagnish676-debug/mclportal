'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="border border-emerald-200 hover:bg-emerald-50 text-emerald-700 px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors print:hidden"
    >
      🖨️ Print Layout
    </button>
  )
}
