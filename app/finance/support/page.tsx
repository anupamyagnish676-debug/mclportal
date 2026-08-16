import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function FinanceSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Finance Help & Support Center</h1>
        <p className="text-sm text-slate-500">
          Get assistance on processing paid internship stipends, bank verification, and Area Google Drive payment logs.
        </p>
      </div>

      <HelpAndSupportSection role="finance" />
    </div>
  )
}
