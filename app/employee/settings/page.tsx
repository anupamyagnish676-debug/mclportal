import SettingsForm from '@/components/SettingsForm'
import MFAManager from '@/components/MFAManager'

export default function EmployeeSettingsPage() {
  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Account Settings</h1>
        <p className="text-gray-500 text-sm">Manage your password and security settings</p>
      </div>

      <MFAManager />
      <SettingsForm />
    </div>
  )
}
