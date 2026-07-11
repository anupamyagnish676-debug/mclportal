import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import FinancePaymentActions from './FinancePaymentActions'

export const revalidate = 0

export default async function FinancePaymentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profile?.role !== 'finance') redirect('/login')

  const adminClient = createAdminClient()

  // Fetch all payments
  const { data: payments } = await adminClient
    .from('stipend_payments')
    .select(`
      *,
      internship:internships(
        area,
        serial_no,
        bank_name,
        bank_account_no,
        bank_ifsc_code,
        end_date,
        stipend_frequency,
        student:profiles!internships_student_id_fkey(full_name, email, university, wing)
      )
    `)
    .order('created_at', { ascending: false })

  const typedPayments = (payments || []).map((p: any) => ({
    id: p.id,
    period_label: p.period_label,
    amount: Number(p.amount || 0),
    status: p.status || 'pending',
    remarks: p.remarks || null,
    internship: {
      area: p.internship?.area || 'N/A',
      serial_no: p.internship?.serial_no || null,
      bank_name: p.internship?.bank_name || null,
      bank_account_no: p.internship?.bank_account_no || null,
      bank_ifsc_code: p.internship?.bank_ifsc_code || null,
      end_date: p.internship?.end_date || null,
      stipend_frequency: p.internship?.stipend_frequency || 'monthly',
      student: {
        full_name: p.internship?.student?.full_name || 'N/A',
        email: p.internship?.student?.email || '',
        university: p.internship?.student?.university || 'N/A',
        wing: p.internship?.student?.wing || 'N/A'
      }
    }
  }))

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Stipend Disbursements</h1>
        <p className="text-sm text-gray-500">
          Approve requested payments and mark disbursed stipends for active interns.
        </p>
      </div>

      <FinancePaymentActions initialPayments={typedPayments} />
    </div>
  )
}
