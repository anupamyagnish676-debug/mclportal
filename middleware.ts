import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require Email OTP 2FA verification
const MFA_PROTECTED_PREFIXES = ['/admin', '/finance', '/mentor', '/employee', '/student']

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return supabaseResponse

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, {
            ...options,
            secure: false, // Required for http://localhost
          })
        )
      },
    },
  })

  // Refresh the session
  await supabase.auth.getUser()

  // MFA enforcement for admin and finance routes
  const { pathname } = request.nextUrl
  const requiresMfaCheck = MFA_PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  // Skip the MFA check itself to avoid redirect loops, and skip API routes
  const isMfaExempt =
    pathname === '/mfa-verify' ||
    pathname.startsWith('/mfa-verify') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')

  const ENABLE_2FA = process.env.ENABLE_2FA === 'true'

  if (ENABLE_2FA && requiresMfaCheck && !isMfaExempt) {
    const isMfaVerified = request.cookies.get('mcl-email-mfa-verified')?.value === 'true'
    if (!isMfaVerified) {
      const verifyUrl = new URL('/mfa-verify', request.url)
      verifyUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(verifyUrl)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
