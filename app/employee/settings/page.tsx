import SettingsForm from '@/components/SettingsForm'
import HelpAndSupportSection from '@/components/HelpAndSupportSection'

export default function EmployeeSettingsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Account Settings</h1>
      <p className="text-gray-500 text-sm mb-8">Manage your password and profile settings</p>
      <SettingsForm />
      <HelpAndSupportSection role="employee" />
    </div>
  )
}
