'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [status, setStatus]     = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setStatus('Authenticating...')

    try {
      // Step 0: Clear any stale cookies from previous attempts
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim()
        if (name.startsWith('sb-') || name === 'mcl-session') {
          document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
        }
      })

      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        setError(data.error || 'Login failed')
        setLoading(false)
        setStatus('')
        return
      }

      setStatus(`Signed in as ${data.role} — redirecting...`)

      // Step 1: Manually set the session cookie from JavaScript
      // This is the MOST RELIABLE way — bypasses all Set-Cookie header issues
      if (data.session) {
        const cookieVal = encodeURIComponent(JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }))
        document.cookie = `mcl-session=${cookieVal}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`
      }

      // Step 2: Wait for cookie to settle
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 3: Navigate
      window.location.href = data.redirect

    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Left side: Beautiful Coal Mine Poster with Branding (Desktop only) */}
      <div 
        className="hidden md:flex md:w-1/2 lg:w-3/5 bg-cover bg-center relative"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      >
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-green-950/85 via-black/40 to-black/15" />
        
        {/* Top left mini-branding */}
        <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
          <img src="/coal-india-logo-transparent.png" alt="Coal India Logo" className="h-12 w-auto object-contain brightness-0 invert" />
          <div className="border-l border-white/20 pl-3">
            <p className="text-xs font-bold text-white tracking-wider leading-none">CIL</p>
            <p className="text-[10px] text-gray-300 font-semibold mt-1">MCL SUBSIDIARY</p>
          </div>
        </div>

        {/* Bottom branding text */}
        <div className="absolute bottom-16 left-12 right-12 z-10 text-white space-y-3">
          <h2 className="text-4xl font-extrabold tracking-tight leading-tight lg:text-5xl">
            Mahanadi Coalfields <br/>Limited
          </h2>
          <p className="text-green-200 text-base font-semibold">
            Official Internship Training & Development Portal
          </p>
          <p className="text-gray-300 text-sm max-w-md leading-relaxed">
            Empowering the next generation of engineers, technicians, and managers through hands-on industrial internships in CIL coal fields.
          </p>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 md:w-1/2 lg:w-2/5 bg-white relative">
        {/* Mobile Background Image (Only visible on small screens) */}
        <div 
          className="absolute inset-0 md:hidden bg-cover bg-center"
          style={{ backgroundImage: "url('/login-bg.jpg')" }}
        />
        <div className="absolute inset-0 md:hidden bg-gradient-to-b from-green-950/90 via-black/80 to-black/95" />

        {/* Login Card */}
        <div className="relative z-10 w-full max-w-sm bg-white/95 md:bg-transparent p-8 md:p-0 rounded-2xl md:rounded-none shadow-xl md:shadow-none border border-gray-100 md:border-none backdrop-blur-md md:backdrop-blur-none">
          {/* Logo & Header */}
          <div className="text-center md:text-left mb-8">
            <img src="/mcl-logo-transparent.png" alt="MCL Logo" className="h-14 mx-auto md:mx-0 mb-4 object-contain" />
            <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
            <p className="text-gray-500 text-sm mt-1">Access the Mahanadi Coalfields Limited Portal</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="admin@mcl.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {error}
              </div>
            )}

            {status && !error && (
              <div className="bg-blue-50 border border-blue-200 text-blue-700 px-3 py-2 rounded-lg text-sm flex items-center gap-2">
                <svg className="animate-spin h-4 w-4 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {status}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          <p className="text-center md:text-left text-xs text-gray-400 mt-8">
            Access is managed by the Training & Development (HRD) department.
          </p>
        </div>
      </div>
    </div>
  )
}
