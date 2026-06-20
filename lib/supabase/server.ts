import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes('paste_your')) {
    throw new Error(
      'Supabase env vars are missing or still placeholders. Check .env.local has real values from Supabase Settings → API, then restart `npm run dev`.'
    )
  }

  const cookieStore = await cookies()

  // Check if we have the backup manual session cookie
  const mclSession = cookieStore.get('mcl-session')
  let manualSession: { access_token: string; refresh_token: string } | null = null
  if (mclSession) {
    try {
      manualSession = JSON.parse(mclSession.value)
    } catch {}
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll() },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, secure: false })
          )
        } catch {}
      },
    },
  })

  // If the standard cookie-based session doesn't work, try setting
  // the session from our manual backup cookie
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && manualSession) {
    console.log('[SERVER] No user from cookies, trying manual session backup...')
    await supabase.auth.setSession({
      access_token: manualSession.access_token,
      refresh_token: manualSession.refresh_token,
    })
  }

  return supabase
}
