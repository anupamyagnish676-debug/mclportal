import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGIN_BLOCKED'
  | 'LOGOUT'
  | 'MFA_VERIFIED'
  | 'SESSION_EXPIRED'
  | 'SESSION_KICKED'
  | 'CERTIFICATE_ISSUED'
  | 'APPLICATION_APPROVED'
  | 'APPLICATION_REJECTED'
  | 'USER_CREATED'
  | 'USER_DELETED'
  | 'NOTICE_POSTED'
  | 'NOTICE_DELETED'
  | 'DOCUMENT_APPROVED'
  | 'DOCUMENT_REJECTED'

interface AuditParams {
  userId?: string
  userEmail?: string
  role?: string
  action: AuditAction
  details?: Record<string, any>
  ip?: string
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const admin = createAdminClient()
    await admin.from('audit_log').insert({
      user_id: params.userId || null,
      user_email: params.userEmail || null,
      role: params.role || null,
      action: params.action,
      details: params.details || null,
      ip_address: params.ip || null,
    })
  } catch {
    // Non-critical — never let audit log failure break the main flow
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
