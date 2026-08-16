import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function AdminSupportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Admin Help & Support Center</h1>
        <p className="text-sm text-slate-500">
          Access administrator guidelines, contact central IT support, and manage area drive technical inquiries.
        </p>
      </div>

      <HelpAndSupportSection role="admin" />
    </div>
  )
}
