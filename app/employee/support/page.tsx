import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function EmployeeSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Employee Help & Support Center</h1>
        <p className="text-sm text-slate-500">
          Get assistance on reviewing referral applications and submitting Letter of Recommendation (LoR) documents.
        </p>
      </div>

      <HelpAndSupportSection role="employee" />
    </div>
  )
}
