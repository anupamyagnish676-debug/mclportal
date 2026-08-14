'use client'

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl text-xs font-bold shadow-sm transition-colors print:hidden"
    >
      🖨️ Print / Save PDF
    </button>
  )
}
