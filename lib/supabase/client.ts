import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key || url.includes('paste_your')) {
    throw new Error(
      'Supabase env vars are missing or still placeholders. Check .env.local has real values from Supabase Settings → API, then restart `npm run dev`.'
    )
  }

  return createBrowserClient(url, key, {
    cookieOptions: {
      path: '/',
      secure: false,   // Required for http://localhost
      sameSite: 'lax',
    },
  })
}
