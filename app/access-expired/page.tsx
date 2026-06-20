export default function AccessExpiredPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-2xl shadow border text-center max-w-md w-full">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-red-600 text-3xl">🔒</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">Access Expired</h1>
        <p className="text-gray-500 text-sm">
          Your internship period has ended and portal access has been deactivated.
          Please contact your training office if you believe this is a mistake.
        </p>
      </div>
    </div>
  )
}
