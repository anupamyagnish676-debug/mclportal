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

      // Always set the session cookie so /mfa-verify has an authenticated session
      if (data.session) {
        const cookieVal = encodeURIComponent(JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }))
        document.cookie = `mcl-session=${cookieVal}; path=/; max-age=${7 * 24 * 60 * 60}; samesite=lax`
      }

      // Step 2: Wait for cookie to settle
      await new Promise(resolve => setTimeout(resolve, 300))

      // Step 3: Navigate — to MFA verify page if required, otherwise to dashboard
      if (data.requires_mfa && data.mfa_redirect) {
        window.location.href = data.mfa_redirect
      } else {
        window.location.href = data.redirect
      }

    } catch (err: any) {
      setError(err.message || 'Network error')
      setLoading(false)
      setStatus('')
    }
  }

  return (
    <div className="min-h-screen w-full relative flex items-center justify-center md:justify-between p-6 sm:p-12 md:p-20 overflow-hidden font-sans bg-[#020617]">
      {/* 1. Ken Burns Animated Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center z-0 scale-105 pointer-events-none select-none brightness-[0.8] animate-kenburns"
        style={{ backgroundImage: "url('/login-bg.jpg')" }}
      />
      
      {/* 2. Cinematic Gradient Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#021f18]/95 via-[#020617]/80 to-[#030712]/50 z-0 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#020617]/40 to-[#020617]/90 z-0 pointer-events-none" />
      
      {/* 3. Tech Grids (Contour & Dot Matrix style) */}
      <div className="absolute inset-0 bg-premium-grid z-0 pointer-events-none opacity-60" />
      <div className="absolute inset-0 bg-dot-matrix z-0 pointer-events-none opacity-40" />

      {/* 4. Animated Large Glowing Spheres (Ambient Light) */}
      <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] z-0 pointer-events-none animate-float-1" />
      <div className="absolute -bottom-20 right-10 w-[600px] h-[600px] bg-green-900/20 rounded-full blur-[140px] z-0 pointer-events-none animate-float-2" />
      {/* Subtle warm amber glow representing mining energy & premium contrast */}
      <div className="absolute top-1/3 right-1/4 w-[350px] h-[350px] bg-amber-500/5 rounded-full blur-[100px] z-0 pointer-events-none animate-float-1" />

      {/* 5. Drifting Energy Micro-particles */}
      <div className="absolute left-[12%] w-1 h-1 bg-amber-400/40 rounded-full blur-[0.5px] pointer-events-none z-0 animate-particle-1" />
      <div className="absolute left-[38%] w-1.5 h-1.5 bg-emerald-400/30 rounded-full blur-[1px] pointer-events-none z-0 animate-particle-2" />
      <div className="absolute left-[62%] w-1 h-1 bg-amber-500/50 rounded-full blur-[0.5px] pointer-events-none z-0 animate-particle-3" />
      <div className="absolute left-[88%] w-2 h-2 bg-emerald-500/20 rounded-full blur-[1.5px] pointer-events-none z-0 animate-particle-1" style={{ animationDelay: '-11s' }} />

      {/* Left side: Premium Branding & Typography (Hidden on mobile, beautiful on desktop) */}
      <div className="hidden md:flex flex-col justify-between h-full max-w-lg z-10 space-y-12">
        {/* Top logo & branding */}
        <div className="flex items-center gap-3">
          <img src="/coal-india-logo-transparent.png" alt="Coal India Logo" className="h-14 w-auto object-contain brightness-0 invert" />
          <div className="border-l border-white/20 pl-3">
            <p className="text-sm font-bold text-white tracking-widest leading-none">COAL INDIA</p>
            <p className="text-[10px] text-green-400 font-semibold tracking-wider mt-1.5 uppercase">MCL Subsidiary</p>
          </div>
        </div>

        {/* Center branding text */}
        <div className="space-y-4">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase bg-emerald-950/60 border border-emerald-500/30 px-3.5 py-1.5 rounded-full w-fit block backdrop-blur-sm">
            ✨ Internship Portal
          </span>
          <h2 className="text-5xl font-extrabold text-white tracking-tight leading-tight lg:text-6xl drop-shadow-lg">
            Mahanadi <br/>Coalfields <span className="text-emerald-400">Ltd.</span>
          </h2>
          <p className="text-slate-300 text-sm leading-relaxed max-w-md">
            Connecting aspiring professionals with industrial excellence. Manage your attendance, logbooks, materials, and certificates securely in one unified hub.
          </p>
        </div>

        {/* Footer Info */}
        <div className="text-[10px] text-white/40 tracking-wider">
          © 2026 MAHANADI COALFIELDS LIMITED. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Right side: Elegant Glassmorphism Login Card */}
      <div className="z-10 w-full max-w-md bg-[#040f0c]/60 border border-white/10 backdrop-blur-2xl p-8 sm:p-10 rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.6)] flex flex-col justify-between relative overflow-hidden group">
        {/* Highlight sheen lines in card corners */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="absolute top-0 right-0 w-[50px] h-[50px] bg-emerald-500/5 rounded-full blur-xl pointer-events-none group-hover:bg-emerald-500/10 transition-all duration-700" />
        
        <div>
          {/* Header */}
          <div className="mb-8">
            <img src="/mcl-logo-transparent.png" alt="MCL Logo" className="h-12 object-contain mb-5" />
            <h1 className="text-2xl font-bold text-white tracking-tight">Sign In</h1>
            <p className="text-slate-400 text-xs mt-1">Access your dashboard with credentials</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                placeholder="admin@mcl.com"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-[#020617]/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300"
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-500/20 text-red-300 px-4 py-3 rounded-xl text-xs backdrop-blur-sm">
                ⚠️ {error}
              </div>
            )}

            {status && !error && (
              <div className="bg-blue-950/40 border border-blue-500/20 text-blue-300 px-4 py-3 rounded-xl text-xs flex items-center gap-2 backdrop-blur-sm">
                <svg className="animate-spin h-4 w-4 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {status}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white py-3 rounded-xl text-sm font-semibold transition-all duration-350 shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.45)] disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-slate-500 mt-8 leading-normal border-t border-white/5 pt-4">
          Training & Development Department, MCL
        </p>
      </div>
    </div>
  )
}
