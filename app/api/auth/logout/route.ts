import { NextResponse } from 'next/server'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  // Clear the manual session cookie on logout
  response.cookies.set('mcl-session', '', { path: '/', maxAge: 0 })
  return response
}
