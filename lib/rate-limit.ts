import { createAdminClient } from '@/lib/supabase/admin'

const MAX_FAILURES = 5
const WINDOW_MINUTES = 15

export async function checkRateLimit(email: string, ip: string): Promise<{
  blocked: boolean
  retryAfterSeconds?: number
  failureCount?: number
}> {
  try {
    const admin = createAdminClient()
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    // Count recent failures for this email
    const { data: attempts, error } = await admin
      .from('login_attempts')
      .select('created_at')
      .eq('email', email.toLowerCase())
      .eq('success', false)
      .gte('created_at', windowStart)
      .order('created_at', { ascending: false })

    if (error || !attempts) return { blocked: false }

    if (attempts.length >= MAX_FAILURES) {
      // Blocked — calculate retry time from the most recent failure
      const latestFailure = new Date(attempts[0].created_at).getTime()
      const unblockAt = latestFailure + WINDOW_MINUTES * 60 * 1000
      const retryAfterSeconds = Math.max(0, Math.ceil((unblockAt - Date.now()) / 1000))
      return { blocked: true, retryAfterSeconds, failureCount: attempts.length }
    }

    return { blocked: false, failureCount: attempts.length }
  } catch {
    // If rate limit check fails, allow through (graceful degradation)
    return { blocked: false }
  }
}

export async function recordLoginAttempt(
  email: string,
  ip: string,
  success: boolean
): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('login_attempts').insert({
      email: email.toLowerCase(),
      ip,
      success,
    })

    // On success, clean up old failed attempts for this email
    if (success) {
      const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
      await admin
        .from('login_attempts')
        .delete()
        .eq('email', email.toLowerCase())
        .eq('success', false)
        .gte('created_at', windowStart)
    }
  } catch {
    // Non-critical — don't break login if this fails
  }
}

export function formatRetryTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) return `${mins}m ${secs}s`
  return `${secs}s`
}
