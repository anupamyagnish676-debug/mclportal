'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

const faqsByRole: Record<string, { q: string; a: string }[]> = {
  student: [
    {
      q: 'How do I upload missing or re-upload rejected verification documents?',
      a: 'Navigate to "Upload Docs" in your menu. Upload your Photo, College ID, Bonafide Certificate, and Aadhaar Card. If a document was rejected by Area Admin, re-upload a clear PDF/image and raise a ticket under Helpdesk Support.'
    },
    {
      q: 'How does my stipend get processed?',
      a: 'If you are enrolled in a Paid Internship, go to "My Stipend" and submit your Bank Account & IFSC details. Area Admin will verify your bank details, and Finance will disburse the stipend at the end of your term.'
    },
    {
      q: 'Where are my daily logbook entries stored?',
      a: 'All your daily logbook entries are saved directly inside your assigned Area Google Drive subfolder under Daily_Logbook.json for permanent record.'
    },
    {
      q: 'How can I verify or download my completion certificate & ID card?',
      a: 'Once your mentor & admin approve your internship, download your official certificate from "Certificate" and ISO standard ID Card from "My ID Card". Anyone can scan the QR code to verify its authenticity on the portal.'
    }
  ],
  mentor: [
    {
      q: 'How do I mark daily attendance for my assigned interns?',
      a: 'Go to "Attendance" in your sidebar, select your intern, and select a date within their approved internship period. Attendance records are updated instantly.'
    },
    {
      q: 'How do I chat 1-on-1 with my interns?',
      a: 'Click "Direct Chat" in your menu. Select an assigned intern from the left panel to send messages and view conversation history saved directly in Area Google Drive.'
    },
    {
      q: 'How do I approve certificate requests for completed interns?',
      a: 'Navigate to "Approve Cert". Review the intern’s logbook and attendance record, then click "Approve Certificate".'
    }
  ],
  admin: [
    {
      q: 'How do Area Google Drive folders work for decentralization?',
      a: 'Each Area (Lingaraj, Talcher, Subhadra, Jagannath, HQ) has a dedicated Google Drive folder where Study Materials, Signatures, Notices, Helpdesk Tickets, and Student folders are stored automatically.'
    },
    {
      q: 'How do I resolve student Helpdesk Support tickets?',
      a: 'Go to "Helpdesk Support" in your menu. View raised tickets, open attached screenshots/documents directly from Google Drive, and enter resolution notes for the intern.'
    },
    {
      q: 'How do I assign mentors to new interns?',
      a: 'Go to "Assign Mentor" to map interns to mentors in your Area.'
    }
  ],
  finance: [
    {
      q: 'How do I process stipend payments for paid interns?',
      a: 'Go to "Payments" in your sidebar. Filter by Area to view interns with verified bank account details and approve payment disbursement.'
    }
  ],
  employee: [
    {
      q: 'How do I review and submit Letter of Recommendation (LoR) applications?',
      a: 'Navigate to "Review LoR" in your sidebar to review pending referral requests.'
    }
  ]
}

export default function HelpAndSupportSection({ role = 'student' }: { role?: string }) {
  const supabase = createClient()
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const [subject, setSubject] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const faqs = faqsByRole[role] || faqsByRole['student']

  async function handleQuickSupportSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!subject.trim() || !description.trim()) return

    setSubmitting(true)
    setErr('')
    setMsg('')

    try {
      const formData = new FormData()
      formData.append('category', 'Profile Helpdesk Inquiry')
      formData.append('subject', subject.trim())
      formData.append('description', description.trim())

      const res = await fetch('/api/support/tickets', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (res.ok) {
        const targetDesc = role === 'admin' ? 'Headquarters (Central Admin)' : 'your Area Admin'
        setMsg(`Support request submitted successfully to ${targetDesc} (Saved to Google Drive)!`)
        setSubject('')
        setDescription('')
      } else {
        setErr(data.error || 'Failed to send support request')
      }
    } catch (e: any) {
      setErr(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-10 pt-8 border-t border-slate-200 space-y-8 max-w-4xl">
      
      {/* Section Header */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl">🎧</span>
          <h2 className="text-xl font-bold text-slate-900">Help & Support Center</h2>
        </div>
        <p className="text-slate-500 text-sm mt-0.5">
          Access role-tailored guides, contact portal support, or raise a ticket saved directly to Google Drive.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">

        {/* Card 1: Official Contacts & Info */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">Headquarters Support</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono border border-emerald-500/30">
              📁 GDrive Sync Active
            </span>
          </div>

          <div className="space-y-3 text-xs text-slate-300">
            <div>
              <p className="font-bold text-white text-sm mb-1">MCL Central Training Office</p>
              <p>Mahanadi Coalfields Limited (HQ), Jagriti Vihar, Burla, Sambalpur, Odisha – 768020</p>
            </div>

            <div className="pt-2 border-t border-white/10 space-y-1">
              <p className="flex items-center gap-2">
                <span>✉️ Email Support:</span>
                <a href="mailto:mclinternshipportal@gmail.com" className="font-mono text-emerald-300 underline font-bold">
                  mclinternshipportal@gmail.com
                </a>
              </p>
              <p className="flex items-center gap-2">
                <span>⏱ Support Hours:</span>
                <span className="text-slate-200 font-medium">Mon – Sat (10:00 AM – 5:00 PM IST)</span>
              </p>
            </div>
          </div>
        </div>

        {/* Card 2: Embedded Quick Ticket Form */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
            <span>🎫 Quick Support Request</span>
          </h3>

          {err && <div className="bg-red-50 text-red-700 text-xs p-2.5 rounded-lg border border-red-200">{err}</div>}
          {msg && <div className="bg-emerald-50 text-emerald-800 text-xs p-2.5 rounded-lg border border-emerald-200">{msg}</div>}

          <form onSubmit={handleQuickSupportSubmit} className="space-y-3">
            <div>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Subject of issue or inquiry"
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe how we can help you..."
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? 'Sending to GDrive...' : 'Submit Support Inquiry'}
            </button>
          </form>
        </div>

      </div>

      {/* Accordion: Frequently Asked Questions */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 text-base flex items-center justify-between">
          <span>❓ Frequently Asked Questions ({role.toUpperCase()})</span>
          <span className="text-xs font-normal text-slate-400">Click to expand</span>
        </h3>

        <div className="space-y-3">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx
            return (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full text-left p-3.5 bg-slate-50/70 hover:bg-slate-100/70 text-xs font-bold text-slate-900 flex items-center justify-between transition-colors"
                >
                  <span>{faq.q}</span>
                  <span className="text-slate-400 text-base">{isOpen ? '−' : '+'}</span>
                </button>

                {isOpen && (
                  <div className="p-3.5 bg-white text-xs text-slate-700 leading-relaxed border-t border-slate-150">
                    {faq.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

    </div>
  )
}
