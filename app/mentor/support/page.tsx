import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function MentorSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Mentor Help & Support Center</h1>
        <p className="text-sm text-slate-500">
          Get assistance on intern evaluations, attendance marking, 1-on-1 direct chat, and area drive storage.
        </p>
      </div>

      <HelpAndSupportSection role="mentor" />
    </div>
  )
}
