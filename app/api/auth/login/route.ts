import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  // Track cookies that Supabase wants to set
  const cookiesToSet: Array<{ name: string; value: string; options: any }> = []

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookies) {
        cookies.forEach(({ name, value, options }) => {
          cookiesToSet.push({ name, value, options })
        })
      },
    },
  })

  // Sign in
  const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

  if (signInError) {
    return NextResponse.json({ error: signInError.message }, { status: 401 })
  }

  if (!data.user || !data.session) {
    return NextResponse.json({ error: 'No session returned.' }, { status: 401 })
  }

  // Get role
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profileError) {
    return NextResponse.json({ error: `Profile error: ${profileError.message}` }, { status: 500 })
  }
  if (!profile) {
    return NextResponse.json({ error: 'No profile found. Contact admin.' }, { status: 404 })
  }

  const role = profile.role
  const dashboardUrl =
    role === 'admin' ? '/admin' :
    role === 'mentor' ? '/mentor' :
    role === 'employee' ? '/employee' :
    role === 'finance' ? '/finance' : '/student'

  // MFA check for admin and finance roles
  if (role === 'admin' || role === 'finance') {
    try {
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aalData && aalData.nextLevel === 'aal2' && aalData.currentLevel !== 'aal2') {
        // User has MFA enrolled but this session is only AAL1 — require verification
        const responseData = {
          role,
          redirect: dashboardUrl,
          requires_mfa: true,
          mfa_redirect: `/mfa-verify?next=${dashboardUrl}`,
          session: {
            access_token: data.session!.access_token,
            refresh_token: data.session!.refresh_token,
          },
        }
        const response = NextResponse.json(responseData)
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            path: '/',
            httpOnly: false,
            secure: false,
            sameSite: 'lax',
          })
        })
        response.cookies.set('mcl-session', JSON.stringify({
          access_token: data.session!.access_token,
          refresh_token: data.session!.refresh_token,
        }), {
          path: '/',
          httpOnly: false,
          secure: false,
          sameSite: 'lax' as const,
          maxAge: 60 * 60 * 24 * 7,
        })
        return response
      }
    } catch {
      // MFA check failed — proceed with normal login (graceful degradation)
    }
  }

  const redirect = dashboardUrl

  const responseData = {
    role,
    redirect,
    session: {
      access_token: data.session!.access_token,
      refresh_token: data.session!.refresh_token,
    },
  }

  // Build response
  const response = NextResponse.json(responseData)

  // Set all Supabase auth cookies on the response with explicit safe options
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, {
      ...options,
      path: '/',
      httpOnly: false,
      secure: false,       // MUST be false for http://localhost
      sameSite: 'lax',
    })
  })

  // Also manually set the session as a backup cookie that we control
  response.cookies.set('mcl-session', JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }), {
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  })

  console.log('[LOGIN API] Cookies being set:', cookiesToSet.map(c => c.name))
  console.log('[LOGIN API] Role:', role, 'Redirect:', redirect)

  return response
}
